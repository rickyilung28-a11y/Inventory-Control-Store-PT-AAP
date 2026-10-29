import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';

/**
 * Public Cloud Sync Topic shared between:
 * 1. Website Server (server.ts)
 * 2. Installed Android .APK (file:///android_asset/index.html) on ANY phone/network
 * 3. iOS / Android Standalone Mobile App on ANY phone/network
 * Zero Google Auth required — completely eliminates 403 errors across all devices!
 */
export const PUBLIC_CLOUD_SYNC_TOPIC = 'pt_aap_ics_state_v3_3aaa5c6cf84e';
export const PUBLIC_CLOUD_DIST_TOPIC = 'pt_aap_ics_dist_v3_3aaa5c6cf84e';

function uleb128(value: number): Buffer {
  const bytes: number[] = [];
  let val = value >>> 0;
  do {
    let byte = val & 0x7f;
    val >>>= 7;
    if (val !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (val !== 0);
  return Buffer.from(bytes);
}

function adler32(buf: Buffer): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function lp32(buf: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.length, 0);
  return Buffer.concat([len, buf]);
}

function buildResourcesArsc(packageName: string): Buffer {
  function makeEmptyStringPool(): Buffer {
    const sp = Buffer.alloc(28, 0);
    sp.writeUInt16LE(0x0001, 0);
    sp.writeUInt16LE(28, 2);
    sp.writeUInt32LE(28, 4);
    sp.writeUInt32LE(0, 8);
    sp.writeUInt32LE(0, 12);
    sp.writeUInt32LE(0x00000100, 16);
    sp.writeUInt32LE(28, 20);
    sp.writeUInt32LE(0, 24);
    return sp;
  }

  const globalStringPool = makeEmptyStringPool();
  const typeStringPool = makeEmptyStringPool();
  const keyStringPool = makeEmptyStringPool();

  const pkgHeaderSize = 288;
  const pkgTotalSize = pkgHeaderSize + typeStringPool.length + keyStringPool.length;
  const pkgHeader = Buffer.alloc(pkgHeaderSize, 0);
  pkgHeader.writeUInt16LE(0x0200, 0);
  pkgHeader.writeUInt16LE(pkgHeaderSize, 2);
  pkgHeader.writeUInt32LE(pkgTotalSize, 4);
  pkgHeader.writeUInt32LE(0x0000007f, 8);

  const nameUtf16 = Buffer.from(packageName, 'utf16le');
  nameUtf16.copy(pkgHeader, 12, 0, Math.min(nameUtf16.length, 254));

  pkgHeader.writeUInt32LE(pkgHeaderSize, 268);
  pkgHeader.writeUInt32LE(0, 272);
  pkgHeader.writeUInt32LE(pkgHeaderSize + typeStringPool.length, 276);
  pkgHeader.writeUInt32LE(0, 280);
  pkgHeader.writeUInt32LE(0, 284);

  const totalSize = 12 + globalStringPool.length + pkgTotalSize;
  const tableHeader = Buffer.alloc(12, 0);
  tableHeader.writeUInt16LE(0x0002, 0);
  tableHeader.writeUInt16LE(12, 2);
  tableHeader.writeUInt32LE(totalSize, 4);
  tableHeader.writeUInt32LE(1, 8);

  return Buffer.concat([
    tableHeader,
    globalStringPool,
    pkgHeader,
    typeStringPool,
    keyStringPool,
  ]);
}

function buildBinaryAndroidManifest(packageName: string): Buffer {
  const attrStrings: { name: string; resId: number }[] = [
    { name: 'theme', resId: 0x01010000 },
    { name: 'label', resId: 0x01010001 },
    { name: 'name', resId: 0x01010003 },
    { name: 'exported', resId: 0x01010010 },
    { name: 'configChanges', resId: 0x0101001f },
    { name: 'minSdkVersion', resId: 0x0101020c },
    { name: 'versionCode', resId: 0x0101021b },
    { name: 'versionName', resId: 0x0101021c },
    { name: 'targetSdkVersion', resId: 0x01010270 },
    { name: 'usesCleartextTraffic', resId: 0x010104ec },
  ];

  const appLabel = 'SISTEN INVENTORY CONTROL STORE PT ABADI AGROSINDO PERSADA';

  const otherStrings = [
    'android',
    'http://schemas.android.com/apk/res/android',
    '',
    'manifest',
    'package',
    packageName,
    '3.0.0-SYNC',
    'uses-sdk',
    'uses-permission',
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.CAMERA',
    'application',
    appLabel,
    'activity',
    'id.gudangpresisi.MainActivity',
    'intent-filter',
    'action',
    'android.intent.action.MAIN',
    'category',
    'android.intent.category.LAUNCHER',
  ];

  const allStrings = [...attrStrings.map((a) => a.name), ...otherStrings];
  const strIndex = (s: string): number => {
    const idx = allStrings.indexOf(s);
    if (idx === -1) throw new Error(`Missing AXML string: ${s}`);
    return idx;
  };

  const encodedStrings: Buffer[] = allStrings.map((s) => {
    const charLen = s.length;
    const strBuf = Buffer.from(s, 'utf16le');
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16LE(charLen, 0);
    const nullTerm = Buffer.alloc(2, 0);
    return Buffer.concat([lenBuf, strBuf, nullTerm]);
  });

  const offsetsBuf = Buffer.alloc(allStrings.length * 4);
  let curOffset = 0;
  for (let i = 0; i < encodedStrings.length; i++) {
    offsetsBuf.writeUInt32LE(curOffset, i * 4);
    curOffset += encodedStrings[i].length;
  }

  let stringsData = Buffer.concat(encodedStrings);
  const padLen = (4 - (stringsData.length % 4)) % 4;
  if (padLen > 0) {
    stringsData = Buffer.concat([stringsData, Buffer.alloc(padLen, 0)]);
  }

  const spHeaderSize = 28;
  const stringsStart = spHeaderSize + offsetsBuf.length;
  const spChunkSize = stringsStart + stringsData.length;
  const spHeader = Buffer.alloc(spHeaderSize);
  spHeader.writeUInt16LE(0x0001, 0);
  spHeader.writeUInt16LE(spHeaderSize, 2);
  spHeader.writeUInt32LE(spChunkSize, 4);
  spHeader.writeUInt32LE(allStrings.length, 8);
  spHeader.writeUInt32LE(0, 12);
  spHeader.writeUInt32LE(0, 16);
  spHeader.writeUInt32LE(stringsStart, 20);
  spHeader.writeUInt32LE(0, 24);

  const stringPoolChunk = Buffer.concat([spHeader, offsetsBuf, stringsData]);

  const resMapSize = 8 + attrStrings.length * 4;
  const resMapChunk = Buffer.alloc(resMapSize);
  resMapChunk.writeUInt16LE(0x0180, 0);
  resMapChunk.writeUInt16LE(8, 2);
  resMapChunk.writeUInt32LE(resMapSize, 4);
  for (let i = 0; i < attrStrings.length; i++) {
    resMapChunk.writeUInt32LE(attrStrings[i].resId, 8 + i * 4);
  }

  const nsPrefix = strIndex('android');
  const nsUri = strIndex('http://schemas.android.com/apk/res/android');
  const noNs = 0xffffffff;

  function makeNamespaceChunk(isStart: boolean, line: number): Buffer {
    const buf = Buffer.alloc(24);
    buf.writeUInt16LE(isStart ? 0x0100 : 0x0101, 0);
    buf.writeUInt16LE(16, 2);
    buf.writeUInt32LE(24, 4);
    buf.writeUInt32LE(line, 8);
    buf.writeUInt32LE(0xffffffff, 12);
    buf.writeUInt32LE(nsPrefix, 16);
    buf.writeUInt32LE(nsUri, 20);
    return buf;
  }

  interface XmlAttr {
    ns: number;
    name: string;
    rawValue: number;
    dataType: number;
    data: number;
  }

  function makeStartElement(name: string, line: number, attrs: XmlAttr[]): Buffer {
    const chunkSize = 36 + attrs.length * 20;
    const buf = Buffer.alloc(chunkSize);
    buf.writeUInt16LE(0x0102, 0);
    buf.writeUInt16LE(16, 2);
    buf.writeUInt32LE(chunkSize, 4);
    buf.writeUInt32LE(line, 8);
    buf.writeUInt32LE(0xffffffff, 12);
    buf.writeUInt32LE(noNs, 16);
    buf.writeUInt32LE(strIndex(name), 20);
    buf.writeUInt16LE(20, 24);
    buf.writeUInt16LE(20, 26);
    buf.writeUInt16LE(attrs.length, 28);
    buf.writeUInt16LE(0, 30);
    buf.writeUInt16LE(0, 32);
    buf.writeUInt16LE(0, 34);

    for (let i = 0; i < attrs.length; i++) {
      const off = 36 + i * 20;
      const a = attrs[i];
      buf.writeUInt32LE(a.ns, off);
      buf.writeUInt32LE(strIndex(a.name), off + 4);
      buf.writeUInt32LE(a.rawValue, off + 8);
      buf.writeUInt16LE(8, off + 12);
      buf.writeUInt8(0, off + 14);
      buf.writeUInt8(a.dataType, off + 15);
      buf.writeUInt32LE(a.data, off + 16);
    }
    return buf;
  }

  function makeEndElement(name: string, line: number): Buffer {
    const buf = Buffer.alloc(24);
    buf.writeUInt16LE(0x0103, 0);
    buf.writeUInt16LE(16, 2);
    buf.writeUInt32LE(24, 4);
    buf.writeUInt32LE(line, 8);
    buf.writeUInt32LE(0xffffffff, 12);
    buf.writeUInt32LE(noNs, 16);
    buf.writeUInt32LE(strIndex(name), 20);
    return buf;
  }

  function strAttr(ns: number, name: string, val: string): XmlAttr {
    const idx = strIndex(val);
    return { ns, name, rawValue: idx, dataType: 0x03, data: idx };
  }

  function intAttr(ns: number, name: string, val: number): XmlAttr {
    return { ns, name, rawValue: 0xffffffff, dataType: 0x10, data: val >>> 0 };
  }

  function boolAttr(ns: number, name: string, val: boolean): XmlAttr {
    return {
      ns,
      name,
      rawValue: 0xffffffff,
      dataType: 0x12,
      data: val ? 0xffffffff : 0x00000000,
    };
  }

  function refAttr(ns: number, name: string, resId: number): XmlAttr {
    return { ns, name, rawValue: 0xffffffff, dataType: 0x01, data: resId >>> 0 };
  }

  const xmlBody = Buffer.concat([
    makeNamespaceChunk(true, 1),
    makeStartElement('manifest', 2, [
      intAttr(nsUri, 'versionCode', 30),
      strAttr(nsUri, 'versionName', '3.0.0-SYNC'),
      strAttr(noNs, 'package', packageName),
    ]),
    makeStartElement('uses-sdk', 3, [
      intAttr(nsUri, 'minSdkVersion', 24),
      intAttr(nsUri, 'targetSdkVersion', 33),
    ]),
    makeEndElement('uses-sdk', 3),
    makeStartElement('uses-permission', 4, [
      strAttr(nsUri, 'name', 'android.permission.INTERNET'),
    ]),
    makeEndElement('uses-permission', 4),
    makeStartElement('uses-permission', 5, [
      strAttr(nsUri, 'name', 'android.permission.ACCESS_NETWORK_STATE'),
    ]),
    makeEndElement('uses-permission', 5),
    makeStartElement('uses-permission', 6, [
      strAttr(nsUri, 'name', 'android.permission.CAMERA'),
    ]),
    makeEndElement('uses-permission', 6),
    makeStartElement('application', 7, [
      refAttr(nsUri, 'theme', 0x01030224),
      strAttr(nsUri, 'label', appLabel),
      boolAttr(nsUri, 'usesCleartextTraffic', true),
    ]),
    makeStartElement('activity', 8, [
      strAttr(nsUri, 'label', appLabel),
      strAttr(nsUri, 'name', 'id.gudangpresisi.MainActivity'),
      boolAttr(nsUri, 'exported', true),
      intAttr(nsUri, 'configChanges', 0x04a0),
    ]),
    makeStartElement('intent-filter', 9, []),
    makeStartElement('action', 10, [
      strAttr(nsUri, 'name', 'android.intent.action.MAIN'),
    ]),
    makeEndElement('action', 10),
    makeStartElement('category', 11, [
      strAttr(nsUri, 'name', 'android.intent.category.LAUNCHER'),
    ]),
    makeEndElement('category', 11),
    makeEndElement('intent-filter', 9),
    makeEndElement('activity', 8),
    makeEndElement('application', 7),
    makeEndElement('manifest', 2),
    makeNamespaceChunk(false, 12),
  ]);

  const totalSize = 8 + stringPoolChunk.length + resMapChunk.length + xmlBody.length;
  const xmlHeader = Buffer.alloc(8);
  xmlHeader.writeUInt16LE(0x0003, 0);
  xmlHeader.writeUInt16LE(8, 2);
  xmlHeader.writeUInt32LE(totalSize, 4);

  return Buffer.concat([xmlHeader, stringPoolChunk, resMapChunk, xmlBody]);
}

function buildClassesDex(targetAppUrl: string): Buffer {
  const rawStrings = [
    '<init>',
    'L',
    'Landroid/app/Activity;',
    'Landroid/content/Context;',
    'Landroid/os/Bundle;',
    'Landroid/view/View;',
    'Landroid/webkit/WebSettings;',
    'Landroid/webkit/WebView;',
    'Landroid/webkit/WebViewClient;',
    'Lid/gudangpresisi/MainActivity;',
    'MainActivity.java',
    'V',
    'VL',
    'VZ',
    'Z',
    'getSettings',
    'loadUrl',
    'onCreate',
    'setContentView',
    'setDomStorageEnabled',
    'setJavaScriptEnabled',
    'setWebViewClient',
    targetAppUrl,
  ];

  const strings = Array.from(new Set(rawStrings)).sort();
  const sIdx = (s: string): number => {
    const i = strings.indexOf(s);
    if (i === -1) throw new Error(`DEX missing string: ${s}`);
    return i;
  };

  const types = [
    'Landroid/app/Activity;',
    'Landroid/content/Context;',
    'Landroid/os/Bundle;',
    'Landroid/view/View;',
    'Landroid/webkit/WebSettings;',
    'Landroid/webkit/WebView;',
    'Landroid/webkit/WebViewClient;',
    'Lid/gudangpresisi/MainActivity;',
    'V',
    'Z',
  ].sort((a, b) => sIdx(a) - sIdx(b));

  const tIdx = (t: string): number => {
    const i = types.indexOf(t);
    if (i === -1) throw new Error(`DEX missing type: ${t}`);
    return i;
  };

  interface ProtoDef {
    key: string;
    shorty: string;
    returnType: string;
    params: string[];
  }

  const protos: ProtoDef[] = [
    { key: '()Landroid/webkit/WebSettings;', shorty: 'L', returnType: 'Landroid/webkit/WebSettings;', params: [] },
    { key: '()V', shorty: 'V', returnType: 'V', params: [] },
    { key: '(Landroid/content/Context;)V', shorty: 'VL', returnType: 'V', params: ['Landroid/content/Context;'] },
    { key: '(Landroid/os/Bundle;)V', shorty: 'VL', returnType: 'V', params: ['Landroid/os/Bundle;'] },
    { key: '(Landroid/view/View;)V', shorty: 'VL', returnType: 'V', params: ['Landroid/view/View;'] },
    { key: '(Landroid/webkit/WebViewClient;)V', shorty: 'VL', returnType: 'V', params: ['Landroid/webkit/WebViewClient;'] },
    { key: '(Ljava/lang/String;)V', shorty: 'VL', returnType: 'V', params: ['Landroid/view/View;'] },
    { key: '(Z)V', shorty: 'VZ', returnType: 'V', params: ['Z'] },
  ];

  rawStrings.push('Ljava/lang/String;');
  return buildClassesDexClean(targetAppUrl);
}

function buildClassesDexClean(targetAppUrl: string): Buffer {
  const rawStrings = [
    '<init>',
    'L',
    'Landroid/app/Activity;',
    'Landroid/content/Context;',
    'Landroid/os/Bundle;',
    'Landroid/view/View;',
    'Landroid/webkit/WebSettings;',
    'Landroid/webkit/WebView;',
    'Landroid/webkit/WebViewClient;',
    'Lid/gudangpresisi/MainActivity;',
    'Ljava/lang/String;',
    'MainActivity.java',
    'V',
    'VL',
    'VZ',
    'Z',
    'getSettings',
    'loadUrl',
    'onCreate',
    'setContentView',
    'setDomStorageEnabled',
    'setJavaScriptEnabled',
    'setWebViewClient',
    targetAppUrl,
  ];

  const strings = Array.from(new Set(rawStrings)).sort();
  const sIdx = (s: string): number => {
    const i = strings.indexOf(s);
    if (i === -1) throw new Error(`DEX missing string: ${s}`);
    return i;
  };

  const types = [
    'Landroid/app/Activity;',
    'Landroid/content/Context;',
    'Landroid/os/Bundle;',
    'Landroid/view/View;',
    'Landroid/webkit/WebSettings;',
    'Landroid/webkit/WebView;',
    'Landroid/webkit/WebViewClient;',
    'Lid/gudangpresisi/MainActivity;',
    'Ljava/lang/String;',
    'V',
    'Z',
  ].sort((a, b) => sIdx(a) - sIdx(b));

  const tIdx = (t: string): number => {
    const i = types.indexOf(t);
    if (i === -1) throw new Error(`DEX missing type: ${t}`);
    return i;
  };

  interface ProtoDef {
    key: string;
    shorty: string;
    returnType: string;
    params: string[];
  }

  const protos: ProtoDef[] = [
    { key: '()WebSettings', shorty: 'L', returnType: 'Landroid/webkit/WebSettings;', params: [] },
    { key: '()V', shorty: 'V', returnType: 'V', params: [] },
    { key: '(Context)V', shorty: 'VL', returnType: 'V', params: ['Landroid/content/Context;'] },
    { key: '(Bundle)V', shorty: 'VL', returnType: 'V', params: ['Landroid/os/Bundle;'] },
    { key: '(View)V', shorty: 'VL', returnType: 'V', params: ['Landroid/view/View;'] },
    { key: '(WebViewClient)V', shorty: 'VL', returnType: 'V', params: ['Landroid/webkit/WebViewClient;'] },
    { key: '(String)V', shorty: 'VL', returnType: 'V', params: ['Ljava/lang/String;'] },
    { key: '(Z)V', shorty: 'VZ', returnType: 'V', params: ['Z'] },
  ].sort((a, b) => {
    const rDiff = tIdx(a.returnType) - tIdx(b.returnType);
    if (rDiff !== 0) return rDiff;
    const len = Math.min(a.params.length, b.params.length);
    for (let i = 0; i < len; i++) {
      const pDiff = tIdx(a.params[i]) - tIdx(b.params[i]);
      if (pDiff !== 0) return pDiff;
    }
    return a.params.length - b.params.length;
  });

  const pIdx = (key: string): number => {
    const i = protos.findIndex((p) => p.key === key);
    if (i === -1) throw new Error(`DEX missing proto: ${key}`);
    return i;
  };

  interface MethodDef {
    key: string;
    classType: string;
    protoKey: string;
    name: string;
  }

  const methods: MethodDef[] = [
    { key: 'Activity.<init>', classType: 'Landroid/app/Activity;', protoKey: '()V', name: '<init>' },
    { key: 'Activity.onCreate', classType: 'Landroid/app/Activity;', protoKey: '(Bundle)V', name: 'onCreate' },
    { key: 'Activity.setContentView', classType: 'Landroid/app/Activity;', protoKey: '(View)V', name: 'setContentView' },
    { key: 'WebSettings.setDomStorageEnabled', classType: 'Landroid/webkit/WebSettings;', protoKey: '(Z)V', name: 'setDomStorageEnabled' },
    { key: 'WebSettings.setJavaScriptEnabled', classType: 'Landroid/webkit/WebSettings;', protoKey: '(Z)V', name: 'setJavaScriptEnabled' },
    { key: 'WebView.<init>', classType: 'Landroid/webkit/WebView;', protoKey: '(Context)V', name: '<init>' },
    { key: 'WebView.getSettings', classType: 'Landroid/webkit/WebView;', protoKey: '()WebSettings', name: 'getSettings' },
    { key: 'WebView.loadUrl', classType: 'Landroid/webkit/WebView;', protoKey: '(String)V', name: 'loadUrl' },
    { key: 'WebView.setWebViewClient', classType: 'Landroid/webkit/WebView;', protoKey: '(WebViewClient)V', name: 'setWebViewClient' },
    { key: 'WebViewClient.<init>', classType: 'Landroid/webkit/WebViewClient;', protoKey: '()V', name: '<init>' },
    { key: 'MainActivity.<init>', classType: 'Lid/gudangpresisi/MainActivity;', protoKey: '()V', name: '<init>' },
    { key: 'MainActivity.onCreate', classType: 'Lid/gudangpresisi/MainActivity;', protoKey: '(Bundle)V', name: 'onCreate' },
  ].sort((a, b) => {
    const cDiff = tIdx(a.classType) - tIdx(b.classType);
    if (cDiff !== 0) return cDiff;
    const nDiff = sIdx(a.name) - sIdx(b.name);
    if (nDiff !== 0) return nDiff;
    return pIdx(a.protoKey) - pIdx(b.protoKey);
  });

  const mIdx = (key: string): number => {
    const i = methods.findIndex((m) => m.key === key);
    if (i === -1) throw new Error(`DEX missing method: ${key}`);
    return i;
  };

  const headerSize = 0x70;
  const stringIdsSize = strings.length;
  const stringIdsOff = headerSize;

  const typeIdsSize = types.length;
  const typeIdsOff = stringIdsOff + stringIdsSize * 4;

  const protoIdsSize = protos.length;
  const protoIdsOff = typeIdsOff + typeIdsSize * 4;

  const methodIdsSize = methods.length;
  const methodIdsOff = protoIdsOff + protoIdsSize * 12;

  const classDefsSize = 1;
  const classDefsOff = methodIdsOff + methodIdsSize * 8;

  const dataOff = classDefsOff + classDefsSize * 32;

  const chunks: Buffer[] = [];
  let curOff = dataOff;

  function align4() {
    const rem = curOff % 4;
    if (rem !== 0) {
      const pad = Buffer.alloc(4 - rem, 0);
      chunks.push(pad);
      curOff += pad.length;
    }
  }

  const protoTypeListOffs: number[] = [];
  let firstTypeListOff = 0;
  let typeListCount = 0;
  for (const p of protos) {
    if (p.params.length === 0) {
      protoTypeListOffs.push(0);
    } else {
      align4();
      if (firstTypeListOff === 0) firstTypeListOff = curOff;
      typeListCount++;
      protoTypeListOffs.push(curOff);
      const tl = Buffer.alloc(4 + p.params.length * 2);
      tl.writeUInt32LE(p.params.length, 0);
      for (let i = 0; i < p.params.length; i++) {
        tl.writeUInt16LE(tIdx(p.params[i]), 4 + i * 2);
      }
      chunks.push(tl);
      curOff += tl.length;
    }
  }

  align4();
  const firstCodeItemOff = curOff;

  const initCodeOff = curOff;
  const initCode = Buffer.alloc(16 + 8);
  initCode.writeUInt16LE(1, 0);
  initCode.writeUInt16LE(1, 2);
  initCode.writeUInt16LE(1, 4);
  initCode.writeUInt16LE(0, 6);
  initCode.writeUInt32LE(0, 8);
  initCode.writeUInt32LE(4, 12);
  initCode.writeUInt16LE(0x1070, 16);
  initCode.writeUInt16LE(mIdx('Activity.<init>'), 18);
  initCode.writeUInt16LE(0x0000, 20);
  initCode.writeUInt16LE(0x000e, 22);
  chunks.push(initCode);
  curOff += initCode.length;

  align4();
  const onCreateInsns: number[] = [
    0x206f, mIdx('Activity.onCreate'), 0x0043,
    0x0022, tIdx('Landroid/webkit/WebView;'),
    0x2070, mIdx('WebView.<init>'), 0x0030,
    0x106e, mIdx('WebView.getSettings'), 0x0000,
    0x010c,
    0x1212,
    0x206e, mIdx('WebSettings.setJavaScriptEnabled'), 0x0021,
    0x206e, mIdx('WebSettings.setDomStorageEnabled'), 0x0021,
    0x0122, tIdx('Landroid/webkit/WebViewClient;'),
    0x1070, mIdx('WebViewClient.<init>'), 0x0001,
    0x206e, mIdx('WebView.setWebViewClient'), 0x0010,
    0x011a, sIdx(targetAppUrl),
    0x206e, mIdx('WebView.loadUrl'), 0x0010,
    0x206e, mIdx('Activity.setContentView'), 0x0003,
    0x000e,
  ];

  const onCreateCodeOff = curOff;
  const onCreateCode = Buffer.alloc(16 + onCreateInsns.length * 2);
  onCreateCode.writeUInt16LE(5, 0);
  onCreateCode.writeUInt16LE(2, 2);
  onCreateCode.writeUInt16LE(2, 4);
  onCreateCode.writeUInt16LE(0, 6);
  onCreateCode.writeUInt32LE(0, 8);
  onCreateCode.writeUInt32LE(onCreateInsns.length, 12);
  for (let i = 0; i < onCreateInsns.length; i++) {
    onCreateCode.writeUInt16LE(onCreateInsns[i], 16 + i * 2);
  }
  chunks.push(onCreateCode);
  curOff += onCreateCode.length;

  const firstStringDataOff = curOff;
  const stringDataOffs: number[] = [];
  for (const s of strings) {
    stringDataOffs.push(curOff);
    const utf8Buf = Buffer.from(s, 'utf8');
    const lenPrefix = uleb128(s.length);
    const itemBuf = Buffer.concat([lenPrefix, utf8Buf, Buffer.from([0])]);
    chunks.push(itemBuf);
    curOff += itemBuf.length;
  }

  const classDataOff = curOff;
  const directMethodIdx = mIdx('MainActivity.<init>');
  const virtualMethodIdx = mIdx('MainActivity.onCreate');
  const classDataBuf = Buffer.concat([
    uleb128(0),
    uleb128(0),
    uleb128(1),
    uleb128(1),
    uleb128(directMethodIdx),
    uleb128(0x10001),
    uleb128(initCodeOff),
    uleb128(virtualMethodIdx),
    uleb128(0x0004),
    uleb128(onCreateCodeOff),
  ]);
  chunks.push(classDataBuf);
  curOff += classDataBuf.length;

  align4();
  const mapOff = curOff;
  const mapItems: { type: number; size: number; offset: number }[] = [
    { type: 0x0000, size: 1, offset: 0 },
    { type: 0x0001, size: stringIdsSize, offset: stringIdsOff },
    { type: 0x0002, size: typeIdsSize, offset: typeIdsOff },
    { type: 0x0003, size: protoIdsSize, offset: protoIdsOff },
    { type: 0x0005, size: methodIdsSize, offset: methodIdsOff },
    { type: 0x0006, size: classDefsSize, offset: classDefsOff },
    { type: 0x1001, size: typeListCount, offset: firstTypeListOff },
    { type: 0x2001, size: 2, offset: firstCodeItemOff },
    { type: 0x2002, size: strings.length, offset: firstStringDataOff },
    { type: 0x2000, size: 1, offset: classDataOff },
    { type: 0x1000, size: 1, offset: mapOff },
  ];

  const mapBuf = Buffer.alloc(4 + mapItems.length * 12);
  mapBuf.writeUInt32LE(mapItems.length, 0);
  for (let i = 0; i < mapItems.length; i++) {
    const m = mapItems[i];
    const off = 4 + i * 12;
    mapBuf.writeUInt16LE(m.type, off);
    mapBuf.writeUInt16LE(0, off + 2);
    mapBuf.writeUInt32LE(m.size, off + 4);
    mapBuf.writeUInt32LE(m.offset, off + 8);
  }
  chunks.push(mapBuf);
  curOff += mapBuf.length;
  align4();

  const fileSize = curOff;
  const dataSize = fileSize - dataOff;

  const stringIdsBuf = Buffer.alloc(stringIdsSize * 4);
  for (let i = 0; i < stringIdsSize; i++) {
    stringIdsBuf.writeUInt32LE(stringDataOffs[i], i * 4);
  }

  const typeIdsBuf = Buffer.alloc(typeIdsSize * 4);
  for (let i = 0; i < typeIdsSize; i++) {
    typeIdsBuf.writeUInt32LE(sIdx(types[i]), i * 4);
  }

  const protoIdsBuf = Buffer.alloc(protoIdsSize * 12);
  for (let i = 0; i < protoIdsSize; i++) {
    const p = protos[i];
    protoIdsBuf.writeUInt32LE(sIdx(p.shorty), i * 12);
    protoIdsBuf.writeUInt32LE(tIdx(p.returnType), i * 12 + 4);
    protoIdsBuf.writeUInt32LE(protoTypeListOffs[i], i * 12 + 8);
  }

  const methodIdsBuf = Buffer.alloc(methodIdsSize * 8);
  for (let i = 0; i < methodIdsSize; i++) {
    const m = methods[i];
    methodIdsBuf.writeUInt16LE(tIdx(m.classType), i * 8);
    methodIdsBuf.writeUInt16LE(pIdx(m.protoKey), i * 8 + 2);
    methodIdsBuf.writeUInt32LE(sIdx(m.name), i * 8 + 4);
  }

  const classDefsBuf = Buffer.alloc(32);
  classDefsBuf.writeUInt32LE(tIdx('Lid/gudangpresisi/MainActivity;'), 0);
  classDefsBuf.writeUInt32LE(0x0001, 4);
  classDefsBuf.writeUInt32LE(tIdx('Landroid/app/Activity;'), 8);
  classDefsBuf.writeUInt32LE(0, 12);
  classDefsBuf.writeUInt32LE(sIdx('MainActivity.java'), 16);
  classDefsBuf.writeUInt32LE(0, 20);
  classDefsBuf.writeUInt32LE(classDataOff, 24);
  classDefsBuf.writeUInt32LE(0, 28);

  const headerBuf = Buffer.alloc(headerSize, 0);
  headerBuf.write('dex\n035\0', 0, 'ascii');
  headerBuf.writeUInt32LE(fileSize, 32);
  headerBuf.writeUInt32LE(headerSize, 36);
  headerBuf.writeUInt32LE(0x12345678, 40);
  headerBuf.writeUInt32LE(0, 44);
  headerBuf.writeUInt32LE(0, 48);
  headerBuf.writeUInt32LE(mapOff, 52);
  headerBuf.writeUInt32LE(stringIdsSize, 56);
  headerBuf.writeUInt32LE(stringIdsOff, 60);
  headerBuf.writeUInt32LE(typeIdsSize, 64);
  headerBuf.writeUInt32LE(typeIdsOff, 68);
  headerBuf.writeUInt32LE(protoIdsSize, 72);
  headerBuf.writeUInt32LE(protoIdsOff, 76);
  headerBuf.writeUInt32LE(0, 80);
  headerBuf.writeUInt32LE(0, 84);
  headerBuf.writeUInt32LE(methodIdsSize, 88);
  headerBuf.writeUInt32LE(methodIdsOff, 92);
  headerBuf.writeUInt32LE(classDefsSize, 96);
  headerBuf.writeUInt32LE(classDefsOff, 100);
  headerBuf.writeUInt32LE(dataSize, 104);
  headerBuf.writeUInt32LE(dataOff, 108);

  const fullDex = Buffer.concat([
    headerBuf,
    stringIdsBuf,
    typeIdsBuf,
    protoIdsBuf,
    methodIdsBuf,
    classDefsBuf,
    ...chunks,
  ]);

  const sha1 = crypto.createHash('sha1').update(fullDex.subarray(32)).digest();
  sha1.copy(fullDex, 12);

  const checksum = adler32(fullDex.subarray(12));
  fullDex.writeUInt32LE(checksum, 8);

  return fullDex;
}

/**
 * Generates a self-contained, full-featured Android & iOS Mobile Application (assets/index.html)
 * with:
 * - Zero Google Auth / Zero 403 Error (runs locally inside APK via file:///android_asset/index.html or on iOS/Android)
 * - Direct Username & Password Login Screen (Pemohon SIV, Admin Gudang, Kepala Gudang)
 * - Full 3-Role Workflow (Pemohon SIV -> Admin Scan/ACC/LPB -> Kepala Gudang Approve Stock)
 * - Dual-Channel Real-Time Cloud Sync (Public Cloud Relay ntfy.sh + Direct Server API)
 */
export function buildEmbeddedAndroidAppHtml(originUrl: string, initialDataSnapshot: unknown): string {
  const cleanOrigin = originUrl.replace(/\/+$/, '');
  const sharedOrigin = cleanOrigin.replace('//ais-dev-', '//ais-pre-');
  const safeJson = JSON.stringify(initialDataSnapshot || {}).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#0f172a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="ICS PT AAP" />
  <title>SISTEN INVENTORY CONTROL STORE PT ABADI AGROSINDO PERSADA</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #0f172a; min-height: 100vh; }
    /* Login Screen */
    .login-wrap { min-height: 100vh; background: radial-gradient(circle at top, #1e293b, #020617 75%); color: #f8fafc; display: flex; flex-direction: column; justify-content: center; padding: 20px 16px; }
    .login-box { max-width: 420px; width: 100%; margin: 0 auto; background: rgba(15,23,42,0.92); border: 1px solid #334155; border-radius: 20px; padding: 22px 18px; box-shadow: 0 20px 40px rgba(0,0,0,0.45); }
    .brand-icon { width: 52px; height: 52px; border-radius: 16px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 24px; }
    .login-title { font-size: 16px; font-weight: 900; text-align: center; color: #fff; line-height: 1.3; }
    .login-sub { font-size: 11px; font-weight: 800; text-align: center; color: #34d399; font-family: monospace; letter-spacing: 0.06em; margin-top: 4px; }
    .login-desc { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 6px; margin-bottom: 16px; }
    .lbl { display: block; font-size: 11px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px; margin-top: 10px; }
    .inp { width: 100%; padding: 11px 12px; border-radius: 12px; border: 1px solid #475569; background: #020617; color: #fff; font-size: 13px; outline: none; }
    .inp:focus { border-color: #10b981; }
    .err-box { background: rgba(127,29,29,0.7); border: 1px solid #ef4444; color: #fecaca; padding: 10px 12px; border-radius: 12px; font-size: 11px; margin-bottom: 10px; display: none; }
    .demo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
    .demo-btn { background: #020617; border: 1px solid #334155; border-radius: 12px; padding: 9px 10px; text-align: left; color: #f8fafc; cursor: pointer; }
    .demo-btn:active { transform: scale(0.98); }
    /* Main App */
    .app-wrap { padding-bottom: 82px; display: none; }
    .topbar { background: #0f172a; color: #fff; padding: 12px 14px; position: sticky; top: 0; z-index: 40; box-shadow: 0 4px 12px rgba(15,23,42,0.22); }
    .brand-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .app-title { font-size: 12px; font-weight: 900; letter-spacing: -0.01em; color: #fff; }
    .company-sub { font-size: 10px; font-weight: 700; color: #34d399; font-family: monospace; margin-top: 2px; }
    .sync-pill { font-size: 10px; font-family: monospace; padding: 4px 9px; border-radius: 999px; background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.4); font-weight: 800; cursor: pointer; white-space: nowrap; }
    .user-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #1e293b; font-size: 11px; color: #cbd5e1; }
    .logout-btn { background: #1e293b; color: #fda4af; border: 1px solid #334155; padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer; }
    .container { padding: 12px; max-width: 560px; margin: 0 auto; }
    .card { background: #fff; border-radius: 16px; padding: 14px; border: 1px solid #e2e8f0; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .kpi-card { background: #fff; border-radius: 14px; padding: 12px; border: 1px solid #e2e8f0; }
    .kpi-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; }
    .kpi-val { font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px; }
    .kpi-sub { font-size: 10px; color: #10b981; font-weight: 700; margin-top: 2px; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; font-family: monospace; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-approved { background: #dbeafe; color: #1e40af; }
    .badge-completed { background: #d1fae5; color: #065f46; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px; border-radius: 11px; font-size: 12px; font-weight: 800; border: none; cursor: pointer; width: 100%; margin-top: 8px; }
    .btn:active { transform: scale(0.99); }
    .btn-emerald { background: #10b981; color: #022c22; }
    .btn-blue { background: #2563eb; color: #fff; }
    .btn-amber { background: #f59e0b; color: #0f172a; }
    .btn-slate { background: #0f172a; color: #fff; }
    .btn-outline { background: #f8fafc; color: #0f172a; border: 1px solid #cbd5e1; }
    input.form-inp, select.form-inp, textarea.form-inp { width: 100%; padding: 9px 11px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 12px; margin-top: 4px; margin-bottom: 8px; background: #f8fafc; color: #0f172a; }
    .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #0f172a; display: flex; justify-content: space-around; padding: 8px 4px 14px; border-top: 1px solid #1e293b; z-index: 50; }
    .nav-item { flex: 1; text-align: center; color: #94a3b8; font-size: 10px; font-weight: 800; background: none; border: none; cursor: pointer; padding: 4px; }
    .nav-item.active { color: #34d399; }
    .toast { position: fixed; top: 16px; left: 16px; right: 16px; background: #065f46; color: #fff; padding: 11px 14px; border-radius: 12px; font-size: 12px; font-weight: 800; z-index: 200; display: none; box-shadow: 0 10px 25px rgba(0,0,0,0.35); border: 1px solid #34d399; }
    .item-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; gap: 8px; }
  </style>
</head>
<body>
  <div id="toast" class="toast"></div>

  <!-- SCREEN 1: USERNAME & PASSWORD LOGIN (NO GOOGLE AUTH REQUIRED) -->
  <div id="loginScreen" class="login-wrap">
    <div class="login-box">
      <div class="brand-icon">📦</div>
      <div class="login-title">SISTEN INVENTORY CONTROL STORE</div>
      <div class="login-sub">PT ABADI AGROSINDO PERSADA</div>
      <div class="login-desc">Aplikasi Mobile Android &amp; iOS — Tersinkronisasi Otomatis dengan Website (Tanpa Login Google)</div>

      <div id="loginErr" class="err-box"></div>

      <form onsubmit="handleLoginSubmit(event)">
        <label class="lbl">Username Pengguna</label>
        <input id="inpUsername" class="inp" type="text" placeholder="Contoh: admin / kepala / budi / siti" required autocomplete="username" />

        <label class="lbl">Kata Sandi (Password)</label>
        <input id="inpPassword" class="inp" type="password" placeholder="Masukkan password" required autocomplete="current-password" />

        <button type="submit" class="btn btn-emerald" style="margin-top:14px;padding:12px;">Masuk ke Aplikasi &rarr;</button>
      </form>

      <div style="margin-top:16px;padding-top:14px;border-top:1px solid #1e293b;">
        <div style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;margin-bottom:6px;">
          Akun Cepat (Ketuk untuk Isi Username &amp; Password):
        </div>
        <div id="quickUsersGrid" class="demo-grid"></div>
      </div>
    </div>
  </div>

  <!-- SCREEN 2: MAIN INTEGRATED INVENTORY APP -->
  <div id="appScreen" class="app-wrap">
    <div class="topbar">
      <div class="brand-row">
        <div>
          <div class="app-title">SISTEN INVENTORY CONTROL STORE</div>
          <div class="company-sub">PT ABADI AGROSINDO PERSADA</div>
        </div>
        <button class="sync-pill" onclick="syncWithCloud(true)" id="syncBadge">LIVE SYNC</button>
      </div>
      <div class="user-bar">
        <div>
          Login: <strong id="activeUserName" style="color:#fff;">-</strong>
          <span id="activeUserRoleBadge" class="badge" style="margin-left:4px;background:#065f46;color:#6ee7b7;">-</span>
        </div>
        <button class="logout-btn" onclick="handleLogout()">Keluar / Ganti User</button>
      </div>
    </div>

    <div class="container" id="mainContainer"></div>

    <div class="bottom-nav">
      <button class="nav-item active" id="nav_home" onclick="setTab('home')">🏠 Beranda</button>
      <button class="nav-item" id="nav_scan" onclick="setTab('scan')">📷 Validasi/Approve</button>
      <button class="nav-item" id="nav_siv" onclick="setTab('siv')">📋 SIV &amp; LPB</button>
      <button class="nav-item" id="nav_stock" onclick="setTab('stock')">📦 Master Stok</button>
    </div>
  </div>

  <script>
    var SERVER_ORIGINS = ["${cleanOrigin}", "${sharedOrigin}"];
    var CLOUD_TOPIC = "${PUBLIC_CLOUD_SYNC_TOPIC}";
    var CLOUD_URL = "https://ntfy.sh/" + CLOUD_TOPIC;
    var state = ${safeJson};
    var currentRevision = 1;
    var clientId = "mobile_" + Math.random().toString(36).slice(2, 10);

    if (!state.stockItems) state.stockItems = [];
    if (!state.issueVouchers) state.issueVouchers = [];
    if (!state.lpbDocuments) state.lpbDocuments = [];
    if (!state.stockMovements) state.stockMovements = [];
    if (!state.minStockProposals) state.minStockProposals = [];
    if (!state.users) state.users = [];

    try {
      var savedLocal = localStorage.getItem("ics_pt_aap_v3_state");
      if (savedLocal) {
        var parsed = JSON.parse(savedLocal);
        if (parsed && parsed.data && parsed.data.stockItems && parsed.data.stockItems.length > 0) {
          if ((parsed.revision || 0) >= currentRevision) {
            state = parsed.data;
            currentRevision = parsed.revision || 1;
          }
        }
      }
    } catch (e) {}

    var currentUser = null;
    var currentTab = "home";
    var scannedSkus = {};

    try {
      var savedUser = localStorage.getItem("ics_pt_aap_v3_user");
      if (savedUser) {
        currentUser = JSON.parse(savedUser);
      }
    } catch (e) {}

    function saveLocal() {
      try {
        localStorage.setItem("ics_pt_aap_v3_state", JSON.stringify({
          revision: currentRevision,
          data: state
        }));
      } catch (e) {}
    }

    function showToast(msg) {
      var el = document.getElementById("toast");
      el.textContent = msg;
      el.style.display = "block";
      setTimeout(function() { el.style.display = "none"; }, 3000);
    }

    function renderQuickUsers() {
      var grid = document.getElementById("quickUsersGrid");
      if (!grid) return;
      var activeUsers = (state.users || []).filter(function(u) { return u.isActive !== false; });
      grid.innerHTML = activeUsers.map(function(u) {
        var roleLabel = u.role === "kepala_gudang" ? "KEPALA GUDANG" : u.role === "admin" ? "ADMIN GUDANG" : "PEMOHON SIV";
        var borderCol = u.role === "kepala_gudang" ? "#3b82f6" : u.role === "admin" ? "#10b981" : "#f59e0b";
        return '<button type="button" class="demo-btn" style="border-color:' + borderCol + '66" onclick="fillLogin(\\'' + u.username + '\\', \\'' + u.password + '\\')">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<strong style="font-size:12px;color:#fff;">' + u.username + '</strong>' +
            '<span style="font-size:9px;font-family:monospace;color:' + borderCol + ';font-weight:800;">' + roleLabel + '</span>' +
          '</div>' +
          '<div style="font-size:10px;color:#cbd5e1;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + u.name + '</div>' +
          '<div style="font-size:9px;color:#64748b;font-family:monospace;margin-top:2px;">Pass: ' + u.password + '</div>' +
        '</button>';
      }).join("");
    }

    window.fillLogin = function(u, p) {
      document.getElementById("inpUsername").value = u;
      document.getElementById("inpPassword").value = p;
      document.getElementById("loginErr").style.display = "none";
    };

    window.handleLoginSubmit = function(e) {
      e.preventDefault();
      var u = (document.getElementById("inpUsername").value || "").trim().toLowerCase();
      var p = document.getElementById("inpPassword").value || "";
      var found = (state.users || []).find(function(usr) {
        return usr.username.toLowerCase() === u && usr.password === p && usr.isActive !== false;
      });
      if (!found) {
        var errEl = document.getElementById("loginErr");
        errEl.textContent = "Username atau password tidak sesuai. Ketuk salah satu akun di bawah untuk mengisi otomatis.";
        errEl.style.display = "block";
        return;
      }
      currentUser = found;
      try { localStorage.setItem("ics_pt_aap_v3_user", JSON.stringify(found)); } catch (err) {}
      updateAuthScreens();
      showToast("Selamat datang, " + found.name + "!");
      syncWithCloud(false);
    };

    window.handleLogout = function() {
      currentUser = null;
      try { localStorage.removeItem("ics_pt_aap_v3_user"); } catch (err) {}
      updateAuthScreens();
    };

    function updateAuthScreens() {
      var loginEl = document.getElementById("loginScreen");
      var appEl = document.getElementById("appScreen");
      if (!currentUser) {
        loginEl.style.display = "flex";
        appEl.style.display = "none";
        renderQuickUsers();
      } else {
        loginEl.style.display = "none";
        appEl.style.display = "block";
        document.getElementById("activeUserName").textContent = currentUser.name;
        var roleBadge = document.getElementById("activeUserRoleBadge");
        roleBadge.textContent = currentUser.role === "kepala_gudang" ? "KEPALA GUDANG" : currentUser.role === "admin" ? "ADMIN GUDANG" : "PEMOHON SIV";
        render();
      }
    }

    window.setTab = function(t) {
      currentTab = t;
      ["home", "scan", "siv", "stock"].forEach(function(k) {
        var nav = document.getElementById("nav_" + k);
        if (nav) nav.className = "nav-item" + (k === t ? " active" : "");
      });
      render();
    };

    function applyIncomingState(newData, rev) {
      if (!newData || !newData.stockItems) return;
      state = newData;
      if (rev && rev > currentRevision) currentRevision = rev;
      saveLocal();
      if (currentUser) {
        var refreshedUser = (state.users || []).find(function(u) { return u.id === currentUser.id || u.username === currentUser.username; });
        if (refreshedUser) currentUser = refreshedUser;
        render();
      } else {
        renderQuickUsers();
      }
    }

    // Dual-Channel Cloud Sync: tries direct server API AND Public Zero-Auth Cloud Relay (ntfy.sh)
    window.syncWithCloud = function(manual) {
      var badge = document.getElementById("syncBadge");
      if (badge) badge.textContent = "SYNCING...";

      // 1. Poll Public Cloud Relay (works on ANY Android/iOS phone on 4G/Wi-Fi without Google login!)
      fetch(CLOUD_URL + "/json?poll=1&since=24h")
        .then(function(r) { return r.ok ? r.text() : Promise.reject(); })
        .then(function(txt) {
          var lines = txt.trim().split("\\n").filter(Boolean);
          for (var i = lines.length - 1; i >= 0; i--) {
            try {
              var evt = JSON.parse(lines[i]);
              if (evt.attachment && evt.attachment.url) {
                return fetch(evt.attachment.url).then(function(ar) { return ar.json(); });
              } else if (evt.message && evt.message.startsWith("{")) {
                return JSON.parse(evt.message);
              }
            } catch (e) {}
          }
          return null;
        })
        .then(function(cloudPayload) {
          if (cloudPayload && cloudPayload.data && (cloudPayload.revision || 0) >= currentRevision) {
            applyIncomingState(cloudPayload.data, cloudPayload.revision);
            if (badge) badge.textContent = "CLOUD REV #" + cloudPayload.revision;
            if (manual) showToast("Tersinkronisasi otomatis via Cloud Relay (Rev #" + cloudPayload.revision + ")");
          }
        })
        .catch(function() {});

      // 2. Also try Direct Server Origin if reachable
      SERVER_ORIGINS.forEach(function(orig) {
        if (!orig || !orig.startsWith("http")) return;
        fetch(orig + "/api/sync/state", { mode: "cors" })
          .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
          .then(function(res) {
            if (res && res.data && (res.revision || 0) >= currentRevision) {
              applyIncomingState(res.data, res.revision);
              if (badge) badge.textContent = "LIVE REV #" + res.revision;
            }
          })
          .catch(function() {});
      });
    };

    function pushToCloud(summary) {
      currentRevision = (currentRevision || 1) + 1;
      saveLocal();
      var badge = document.getElementById("syncBadge");
      if (badge) badge.textContent = "REV #" + currentRevision;

      var fullEnvelope = {
        revision: currentRevision,
        updatedAt: new Date().toISOString(),
        lastClientId: clientId,
        lastDeviceType: "ANDROID",
        lastActionSummary: summary,
        userName: currentUser ? currentUser.name : "Mobile User",
        userRole: currentUser ? currentUser.role : "user",
        data: state
      };

      // 1. Push to Public Zero-Auth Cloud Relay (so Website & other phones receive it immediately)
      fetch(CLOUD_URL, {
        method: "PUT",
        headers: { "Filename": "warehouse-state.json" },
        body: JSON.stringify(fullEnvelope)
      }).catch(function() {});

      // 2. Also push to Direct Server API if reachable
      SERVER_ORIGINS.forEach(function(orig) {
        if (!orig || !orig.startsWith("http")) return;
        fetch(orig + "/api/sync/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: clientId,
            deviceType: "ANDROID",
            deviceName: "HP Android/iOS (" + (currentUser ? currentUser.name : "User") + ")",
            userName: currentUser ? currentUser.name : "User",
            userRole: currentUser ? currentUser.role : "user",
            actionSummary: summary,
            collections: state
          })
        }).catch(function() {});
      });
    }

    // Subscribe to real-time SSE from Public Cloud Relay
    try {
      if (typeof EventSource !== "undefined") {
        var es = new EventSource(CLOUD_URL + "/sse");
        es.onmessage = function(ev) {
          try {
            var evt = JSON.parse(ev.data);
            if (evt.attachment && evt.attachment.url) {
              fetch(evt.attachment.url)
                .then(function(r) { return r.json(); })
                .then(function(payload) {
                  if (payload && payload.data && payload.lastClientId !== clientId && (payload.revision || 0) > currentRevision) {
                    applyIncomingState(payload.data, payload.revision);
                    showToast("Update Real-Time: " + (payload.lastActionSummary || "Data diperbarui"));
                  }
                })
                .catch(function() {});
            }
          } catch (e) {}
        };
      }
    } catch (e) {}

    // ROLE 2 (ADMIN): Scan Barcode / Validate Item on SIV
    window.scanItemBarcode = function(voucherId, sku) {
      var key = voucherId + "_" + sku;
      scannedSkus[key] = true;
      showToast("Barcode SKU " + sku + " Tervalidasi!");
      render();
    };

    window.updateSivItemQty = function(voucherId, sku, val) {
      var v = state.issueVouchers.find(function(x) { return x.id === voucherId; });
      if (!v) return;
      var it = v.items.find(function(i) { return i.sku === sku; });
      if (!it) return;
      var num = Math.max(0, Number(val) || 0);
      it.issuedQuantity = num;
      scannedSkus[voucherId + "_" + sku] = true;
      render();
    };

    window.cancelSivItem = function(voucherId, sku) {
      var v = state.issueVouchers.find(function(x) { return x.id === voucherId; });
      if (!v) return;
      var it = v.items.find(function(i) { return i.sku === sku; });
      if (!it) return;
      it.issuedQuantity = 0;
      scannedSkus[voucherId + "_" + sku] = true;
      showToast("Item " + sku + " diset Qty 0 (Batal Sebagian).");
      render();
    };

    window.accSivAdmin = function(id) {
      if (!currentUser || currentUser.role !== "admin") {
        showToast("Hanya Admin Gudang yang dapat melakukan Scan & ACC Validasi SIV!");
        return;
      }
      var v = state.issueVouchers.find(function(x) { return x.id === id; });
      if (!v) return;
      var recEl = document.getElementById("rec_" + id);
      var receiver = (recEl && recEl.value ? recEl.value.trim() : "") || v.receivedBy || v.requestedBy;
      v.status = "APPROVED";
      v.approvedBy = currentUser.name;
      v.approvedAt = new Date().toISOString();
      v.receivedBy = receiver;
      v.items.forEach(function(it) {
        if (it.issuedQuantity === undefined) it.issuedQuantity = it.requestedQuantity;
      });
      pushToCloud("[ANDROID/MOBILE] Admin (" + currentUser.name + ") Validasi Scan & ACC SIV " + v.voucherNumber);
      showToast("SIV " + v.voucherNumber + " berhasil di-ACC Admin! Menunggu Approve Kepala Gudang.");
      render();
    };

    // ROLE 3 (KEPALA GUDANG): Approve Pengurangan Stok (SIV)
    window.approveSivKepala = function(id) {
      if (!currentUser || currentUser.role !== "kepala_gudang") {
        showToast("Hanya Kepala Gudang yang berwenang Approve Pengurangan Stok!");
        return;
      }
      var v = state.issueVouchers.find(function(x) { return x.id === id; });
      if (!v) return;
      v.status = "COMPLETED";
      v.handoverBy = currentUser.name;
      v.handoverAt = new Date().toISOString();
      v.items.forEach(function(it) {
        var qty = it.issuedQuantity !== undefined ? it.issuedQuantity : it.requestedQuantity;
        var st = state.stockItems.find(function(s) { return s.id === it.itemId || s.sku === it.sku; });
        if (st && qty > 0) {
          var prev = st.currentStock;
          st.currentStock = Math.max(0, st.currentStock - qty);
          state.stockMovements.unshift({
            id: "mov_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
            date: new Date().toISOString().slice(0, 10),
            timestamp: new Date().toISOString(),
            type: "OUT",
            referenceNumber: v.voucherNumber,
            itemId: st.id,
            sku: st.sku,
            itemName: st.name,
            quantity: qty,
            unit: st.unit,
            previousStock: prev,
            balanceAfter: st.currentStock,
            departmentOrSupplier: v.department,
            operator: currentUser.name,
            notes: v.purpose
          });
        }
      });
      pushToCloud("[ANDROID/MOBILE] Kepala Gudang (" + currentUser.name + ") Approve Pengurangan Stok SIV " + v.voucherNumber);
      showToast("Pengurangan Stok SIV " + v.voucherNumber + " disetujui Kepala Gudang!");
      render();
    };

    // ROLE 3 (KEPALA GUDANG): Approve Penambahan Stok (LPB)
    window.approveLpbKepala = function(id) {
      if (!currentUser || currentUser.role !== "kepala_gudang") {
        showToast("Hanya Kepala Gudang yang berwenang Approve Penambahan Stok LPB!");
        return;
      }
      var lpb = state.lpbDocuments.find(function(x) { return x.id === id; });
      if (!lpb) return;
      lpb.status = "COMPLETED";
      lpb.approvedBy = currentUser.name;
      lpb.approvedAt = new Date().toISOString();
      lpb.items.forEach(function(it) {
        var st = state.stockItems.find(function(s) { return s.id === it.itemId || s.sku === it.sku; });
        if (st && it.receivedQuantity > 0) {
          var prev = st.currentStock;
          st.currentStock = prev + Number(it.receivedQuantity);
          state.stockMovements.unshift({
            id: "mov_in_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
            date: new Date().toISOString().slice(0, 10),
            timestamp: new Date().toISOString(),
            type: "IN",
            referenceNumber: lpb.lpbNumber,
            itemId: st.id,
            sku: st.sku,
            itemName: st.name,
            quantity: Number(it.receivedQuantity),
            unit: st.unit,
            previousStock: prev,
            balanceAfter: st.currentStock,
            departmentOrSupplier: lpb.supplierName,
            operator: currentUser.name,
            notes: "Penerimaan LPB PO " + (lpb.poNumber || "-")
          });
        }
      });
      pushToCloud("[ANDROID/MOBILE] Kepala Gudang (" + currentUser.name + ") Approve Penambahan Stok LPB " + lpb.lpbNumber);
      showToast("Penambahan Stok LPB " + lpb.lpbNumber + " disetujui Kepala Gudang!");
      render();
    };

    // ROLE 1 (USER PEMOHON): Create SIV from Form
    window.submitNewSivForm = function(e) {
      e.preventDefault();
      var sku = document.getElementById("newSivSku").value;
      var qty = Number(document.getElementById("newSivQty").value || "0");
      var purpose = (document.getElementById("newSivPurpose").value || "").trim() || "Keperluan Operasional";
      var item = state.stockItems.find(function(s) { return s.sku === sku; });
      if (!item || qty <= 0) {
        showToast("Pilih barang dan jumlah qty yang valid!");
        return;
      }
      var newV = {
        id: "v_mob_" + Date.now(),
        voucherNumber: "SIV-AAP-" + String(state.issueVouchers.length + 1).padStart(4, "0"),
        requestDate: new Date().toISOString().slice(0, 10),
        requestedBy: currentUser.name,
        userId: currentUser.id,
        department: currentUser.department || "Operasional",
        costCenter: "20 - Pemeliharaan & Operasional",
        glAccount: "51010",
        purpose: purpose,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        items: [{
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          requestedQuantity: qty,
          issuedQuantity: qty
        }]
      };
      state.issueVouchers.unshift(newV);
      pushToCloud("[ANDROID/MOBILE] Pemohon (" + currentUser.name + ") Terbitkan SIV " + newV.voucherNumber);
      showToast("Nota SIV " + newV.voucherNumber + " diterbitkan & tersinkron ke Website!");
      setTab("siv");
    };

    // ROLE 2 (ADMIN): Create LPB Supplier
    window.submitNewLpbForm = function(e) {
      e.preventDefault();
      var supplier = (document.getElementById("newLpbSupplier").value || "").trim() || "PT Supplier Mitra";
      var sj = (document.getElementById("newLpbSj").value || "").trim() || "SJ-" + Date.now().toString().slice(-4);
      var sku = document.getElementById("newLpbSku").value;
      var qty = Number(document.getElementById("newLpbQty").value || "0");
      var item = state.stockItems.find(function(s) { return s.sku === sku; });
      if (!item || qty <= 0) {
        showToast("Pilih barang dan qty penerimaan LPB!");
        return;
      }
      var newLpb = {
        id: "lpb_mob_" + Date.now(),
        lpbNumber: "LPB-AAP-" + String((state.lpbDocuments || []).length + 1).padStart(4, "0"),
        receiveDate: new Date().toISOString().slice(0, 10),
        supplierName: supplier,
        deliveryNoteNumber: sj,
        poNumber: "PO-" + new Date().getFullYear() + "-" + String((state.lpbDocuments || []).length + 101),
        receivedBy: currentUser.name,
        status: "PENDING_HEAD_APPROVAL",
        createdAt: new Date().toISOString(),
        items: [{
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          orderedQuantity: qty,
          receivedQuantity: qty,
          condition: "BAIK"
        }]
      };
      state.lpbDocuments.unshift(newLpb);
      pushToCloud("[ANDROID/MOBILE] Admin (" + currentUser.name + ") Input LPB " + newLpb.lpbNumber + " (Menunggu Approve Kepala Gudang)");
      showToast("LPB " + newLpb.lpbNumber + " dibuat! Menunggu Approve Kepala Gudang.");
      setTab("scan");
    };

    function render() {
      if (!currentUser) return;
      var c = document.getElementById("mainContainer");
      var role = currentUser.role;
      var pendingSivs = (state.issueVouchers || []).filter(function(v) { return v.status === "PENDING"; });
      var approvedSivs = (state.issueVouchers || []).filter(function(v) { return v.status === "APPROVED"; });
      var pendingLpbs = (state.lpbDocuments || []).filter(function(l) { return l.status === "PENDING_HEAD_APPROVAL"; });
      var lowStocks = (state.stockItems || []).filter(function(s) { return s.currentStock <= s.minStock; });

      if (currentTab === "home") {
        var roleInfoHtml = "";
        if (role === "admin") {
          roleInfoHtml = '<div class="card" style="border-left:4px solid #10b981;">' +
            '<div style="font-size:12px;font-weight:900;color:#065f46;">TUGAS ADMIN GUDANG: HANYA ACC &amp; VALIDASI BARANG / SCAN</div>' +
            '<div style="font-size:11px;color:#475569;margin-top:4px;">Admin melakukan scan barcode barang SIV, menyesuaikan qty aktual (atau 0/batal), dan meng-ACC SIV untuk diteruskan ke Kepala Gudang.</div>' +
            '<button class="btn btn-emerald" onclick="setTab(\\'scan\\')">📷 Buka Antrean Scan &amp; Validasi SIV (' + pendingSivs.length + ')</button>' +
          '</div>';
        } else if (role === "kepala_gudang") {
          roleInfoHtml = '<div class="card" style="border-left:4px solid #2563eb;">' +
            '<div style="font-size:12px;font-weight:900;color:#1e40af;">TUGAS KEPALA GUDANG: APPROVE PENGURANGAN &amp; PENAMBAHAN STOCK</div>' +
            '<div style="font-size:11px;color:#475569;margin-top:4px;">Kepala Gudang menyetujui pengurangan stok (SIV yang sudah di-ACC Admin) serta penambahan stok (LPB Supplier).</div>' +
            '<button class="btn btn-blue" onclick="setTab(\\'scan\\')">✅ Buka Antrean Approve Kepala Gudang (' + (approvedSivs.length + pendingLpbs.length) + ')</button>' +
          '</div>';
        } else {
          roleInfoHtml = '<div class="card" style="border-left:4px solid #f59e0b;">' +
            '<div style="font-size:12px;font-weight:900;color:#92400e;">TUGAS PEMOHON: TERBITKAN &amp; REVISI NOTA SIV</div>' +
            '<div style="font-size:11px;color:#475569;margin-top:4px;">Terbitkan permintaan pengeluaran barang (SIV) dan pantau status persetujuan Admin &amp; Kepala Gudang secara real-time.</div>' +
            '<button class="btn btn-amber" onclick="setTab(\\'siv\\')">+ Buat / Lihat Nota SIV</button>' +
          '</div>';
        }

        c.innerHTML =
          '<div class="kpi-grid">' +
            '<div class="kpi-card" onclick="setTab(\\'scan\\')"><div class="kpi-label">Menunggu Scan Admin</div><div class="kpi-val">' + pendingSivs.length + '</div><div class="kpi-sub">Tahap Validasi / ACC</div></div>' +
            '<div class="kpi-card" onclick="setTab(\\'scan\\')"><div class="kpi-label">Approve Ka. Gudang</div><div class="kpi-val">' + (approvedSivs.length + pendingLpbs.length) + '</div><div class="kpi-sub">' + approvedSivs.length + ' SIV • ' + pendingLpbs.length + ' LPB</div></div>' +
            '<div class="kpi-card" onclick="setTab(\\'stock\\')"><div class="kpi-label">Total Master SKU</div><div class="kpi-val">' + state.stockItems.length + '</div><div class="kpi-sub">Sinkron Website</div></div>' +
            '<div class="kpi-card" onclick="setTab(\\'stock\\')"><div class="kpi-label">Stok Kritis / Min</div><div class="kpi-val" style="color:#dc2626">' + lowStocks.length + '</div><div class="kpi-sub" style="color:#dc2626">Perlu Restock</div></div>' +
          '</div>' +
          roleInfoHtml +
          '<div class="card">' +
            '<div style="font-size:12px;font-weight:800;margin-bottom:4px;">Sinkronisasi Lintas Sistem (Android / iOS &harr; Website)</div>' +
            '<div style="font-size:11px;color:#64748b;">Seluruh aktivitas pada perangkat ini langsung terintegrasi dengan server Website PT Abadi Agrosindo Persada tanpa perlu login Google.</div>' +
            '<button class="btn btn-slate" onclick="syncWithCloud(true)">🔄 Sinkronkan Data Sekarang (Rev #' + currentRevision + ')</button>' +
          '</div>';
      } else if (currentTab === "scan") {
        var html = "";
        if (role === "admin") {
          html += '<div class="card" style="background:#ecfdf5;border-color:#6ee7b7;">' +
            '<div style="font-size:13px;font-weight:900;color:#065f46;">📷 ADMIN GUDANG: VALIDASI BARANG / SCAN &amp; ACC SIV</div>' +
            '<div style="font-size:11px;color:#047857;margin-top:2px;">Ketuk tombol Scan pada tiap barang, sesuaikan Qty aktual (atau klik Batal jika 0), isi Nama Penerima, lalu klik ACC &amp; Validasi SIV.</div>' +
          '</div>';
          if (pendingSivs.length === 0) {
            html += '<div class="card" style="text-align:center;color:#64748b;font-size:12px;">Tidak ada SIV berstatus PENDING yang menunggu scan Admin.</div>';
          }
          pendingSivs.forEach(function(v) {
            html += '<div class="card">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<strong style="font-size:13px;">' + v.voucherNumber + '</strong>' +
                '<span class="badge badge-pending">MENUNGGU SCAN ADMIN</span>' +
              '</div>' +
              '<div style="font-size:11px;color:#475569;margin-top:4px;">Pemohon: <strong>' + v.requestedBy + '</strong> • ' + v.department + '</div>' +
              '<div style="font-size:11px;color:#64748b;">Keperluan: ' + v.purpose + '</div>' +
              '<div style="margin-top:10px;border-top:1px solid #e2e8f0;padding-top:8px;">' +
                v.items.map(function(it) {
                  var isScanned = Boolean(scannedSkus[v.id + "_" + it.sku]);
                  var curQty = it.issuedQuantity !== undefined ? it.issuedQuantity : it.requestedQuantity;
                  return '<div style="padding:8px 0;border-bottom:1px solid #f1f5f9;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                      '<span style="font-size:12px;font-weight:700;">' + it.sku + ' — ' + it.name + '</span>' +
                      '<span class="badge" style="background:' + (isScanned ? '#d1fae5;color:#065f46;' : '#f1f5f9;color:#475569;') + '">' + (isScanned ? '✓ TERVALIDASI' : 'BELUM SCAN') + '</span>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:6px;margin-top:6px;">' +
                      '<button type="button" class="btn btn-outline" style="margin:0;padding:6px 10px;width:auto;font-size:11px;" onclick="scanItemBarcode(\\'' + v.id + '\\', \\'' + it.sku + '\\')">📷 Scan Barcode</button>' +
                      '<input type="number" min="0" value="' + curQty + '" onchange="updateSivItemQty(\\'' + v.id + '\\', \\'' + it.sku + '\\', this.value)" style="width:70px;padding:6px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;font-weight:800;text-align:center;" />' +
                      '<span style="font-size:11px;color:#64748b;">' + it.unit + '</span>' +
                      '<button type="button" class="btn" style="margin:0;padding:6px 8px;width:auto;font-size:10px;background:#fee2e2;color:#991b1b;" onclick="cancelSivItem(\\'' + v.id + '\\', \\'' + it.sku + '\\')">Batal (0)</button>' +
                    '</div>' +
                  '</div>';
                }).join("") +
              '</div>' +
              '<div style="margin-top:8px;">' +
                '<label style="font-size:11px;font-weight:700;color:#334155;">Nama Penerima Barang:</label>' +
                '<input id="rec_' + v.id + '" class="form-inp" type="text" value="' + (v.receivedBy || v.requestedBy) + '" placeholder="Nama penerima barang" />' +
              '</div>' +
              '<button class="btn btn-emerald" onclick="accSivAdmin(\\'' + v.id + '\\')">✅ ACC &amp; Validasi SIV (Teruskan ke Kepala Gudang)</button>' +
            '</div>';
          });
        } else if (role === "kepala_gudang") {
          html += '<div class="card" style="background:#eff6ff;border-color:#93c5fd;">' +
            '<div style="font-size:13px;font-weight:900;color:#1e40af;">✅ KEPALA GUDANG: APPROVE PENGURANGAN &amp; PENAMBAHAN STOK</div>' +
            '<div style="font-size:11px;color:#1d4ed8;margin-top:2px;">Setujui pengurangan stok (SIV yang telah divalidasi Admin) dan penambahan stok (LPB Supplier).</div>' +
          '</div>';

          if (approvedSivs.length === 0 && pendingLpbs.length === 0) {
            html += '<div class="card" style="text-align:center;color:#64748b;font-size:12px;">Tidak ada antrean SIV atau LPB yang menunggu Approve Kepala Gudang.</div>';
          }

          approvedSivs.forEach(function(v) {
            html += '<div class="card">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<strong style="font-size:13px;">' + v.voucherNumber + ' (PENGURANGAN STOK)</strong>' +
                '<span class="badge badge-approved">SUDAH ACC ADMIN</span>' +
              '</div>' +
              '<div style="font-size:11px;color:#475569;margin-top:4px;">Pemohon: <strong>' + v.requestedBy + '</strong> • Di-ACC Admin: <strong>' + (v.approvedBy || "Admin") + '</strong></div>' +
              '<div style="margin-top:8px;">' +
                v.items.map(function(it) {
                  var q = it.issuedQuantity !== undefined ? it.issuedQuantity : it.requestedQuantity;
                  return '<div class="item-row"><span>' + it.sku + ' - ' + it.name + '</span><strong style="color:#dc2626;">-' + q + ' ' + it.unit + '</strong></div>';
                }).join("") +
              '</div>' +
              '<button class="btn btn-blue" onclick="approveSivKepala(\\'' + v.id + '\\')">✅ Approve Pengurangan Stok (Potong Stok)</button>' +
            '</div>';
          });

          pendingLpbs.forEach(function(lpb) {
            html += '<div class="card">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<strong style="font-size:13px;">' + lpb.lpbNumber + ' (PENAMBAHAN STOK)</strong>' +
                '<span class="badge badge-pending">MENUNGGU APPROVE</span>' +
              '</div>' +
              '<div style="font-size:11px;color:#475569;margin-top:4px;">Supplier: <strong>' + lpb.supplierName + '</strong> • SJ: ' + lpb.deliveryNoteNumber + '</div>' +
              '<div style="margin-top:8px;">' +
                lpb.items.map(function(it) {
                  return '<div class="item-row"><span>' + it.sku + ' - ' + it.name + '</span><strong style="color:#059669;">+' + it.receivedQuantity + ' ' + it.unit + '</strong></div>';
                }).join("") +
              '</div>' +
              '<button class="btn btn-emerald" onclick="approveLpbKepala(\\'' + lpb.id + '\\')">✅ Approve Penambahan Stok (Tambah Stok)</button>' +
            '</div>';
          });
        } else {
          html += '<div class="card">' +
            '<div style="font-size:13px;font-weight:800;">Status Validasi SIV Anda</div>' +
            '<div style="font-size:11px;color:#64748b;margin-top:2px;">Anda login sebagai Pemohon (' + currentUser.name + '). Proses Scan dilakukan oleh Admin Gudang dan Approve Stok oleh Kepala Gudang.</div>' +
            '<button class="btn btn-amber" onclick="setTab(\\'siv\\')">Lihat / Buat Nota SIV Anda</button>' +
          '</div>';
        }
        c.innerHTML = html;
      } else if (currentTab === "siv") {
        var itemOptions = (state.stockItems || []).map(function(it) {
          return '<option value="' + it.sku + '">' + it.sku + ' - ' + it.name + ' (Stok: ' + it.currentStock + ' ' + it.unit + ')</option>';
        }).join("");

        var formHtml = "";
        if (role === "user") {
          formHtml = '<div class="card">' +
            '<div style="font-size:13px;font-weight:900;margin-bottom:6px;">+ Terbitkan Nota SIV Baru (Pemohon)</div>' +
            '<form onsubmit="submitNewSivForm(event)">' +
              '<label style="font-size:11px;font-weight:700;">Pilih Barang Gudang</label>' +
              '<select id="newSivSku" class="form-inp">' + itemOptions + '</select>' +
              '<label style="font-size:11px;font-weight:700;">Jumlah Permintaan (Qty)</label>' +
              '<input id="newSivQty" class="form-inp" type="number" min="1" value="2" required />' +
              '<label style="font-size:11px;font-weight:700;">Keperluan Pengambilan</label>' +
              '<input id="newSivPurpose" class="form-inp" type="text" placeholder="Contoh: Pemeliharaan Mesin Produksi" required />' +
              '<button type="submit" class="btn btn-amber">Terbitkan SIV &amp; Sinkronkan</button>' +
            '</form>' +
          '</div>';
        } else if (role === "admin") {
          formHtml = '<div class="card">' +
            '<div style="font-size:13px;font-weight:900;margin-bottom:6px;">+ Input Penerimaan Barang Supplier (LPB)</div>' +
            '<form onsubmit="submitNewLpbForm(event)">' +
              '<label style="font-size:11px;font-weight:700;">Nama Supplier</label>' +
              '<input id="newLpbSupplier" class="form-inp" type="text" placeholder="Contoh: PT Baja Makmur" required />' +
              '<label style="font-size:11px;font-weight:700;">Nomor Surat Jalan (SJ)</label>' +
              '<input id="newLpbSj" class="form-inp" type="text" placeholder="Contoh: SJ-2026-089" required />' +
              '<label style="font-size:11px;font-weight:700;">Pilih Barang Masuk</label>' +
              '<select id="newLpbSku" class="form-inp">' + itemOptions + '</select>' +
              '<label style="font-size:11px;font-weight:700;">Qty Diterima</label>' +
              '<input id="newLpbQty" class="form-inp" type="number" min="1" value="10" required />' +
              '<button type="submit" class="btn btn-emerald">Simpan LPB (Ajukan ke Kepala Gudang)</button>' +
            '</form>' +
          '</div>';
        }

        var listVouchers = state.issueVouchers || [];
        var sHtml = formHtml + '<div class="card"><strong style="font-size:13px;">Daftar Riwayat Nota SIV (' + listVouchers.length + ')</strong></div>';
        listVouchers.forEach(function(v) {
          sHtml += '<div class="card">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
              '<strong>' + v.voucherNumber + '</strong>' +
              '<span class="badge ' + (v.status === "COMPLETED" ? "badge-completed" : v.status === "APPROVED" ? "badge-approved" : "badge-pending") + '">' + v.status + '</span>' +
            '</div>' +
            '<div style="font-size:11px;color:#475569;margin-top:4px;">Pemohon: <strong>' + v.requestedBy + '</strong> • Tgl: ' + v.requestDate + '</div>' +
            '<div style="font-size:11px;color:#64748b;margin-top:2px;">Keperluan: ' + v.purpose + '</div>' +
          '</div>';
        });
        c.innerHTML = sHtml;
      } else {
        var stHtml = '<div class="card"><strong style="font-size:13px;">Master Stok Gudang PT AAP (' + state.stockItems.length + ' SKU)</strong></div>';
        (state.stockItems || []).forEach(function(item) {
          stHtml += '<div class="card">' +
            '<div style="display:flex;justify-content:space-between;"><strong>' + item.name + '</strong><span class="badge" style="background:#f1f5f9;">' + item.sku + '</span></div>' +
            '<div style="font-size:11px;color:#64748b;margin-top:3px;">Lokasi Rak: ' + item.rackLocation + ' • Kategori: ' + item.category + '</div>' +
            '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;">' +
              '<span>Stok Aktual: <strong style="color:' + (item.currentStock <= item.minStock ? '#dc2626' : '#059669') + '">' + item.currentStock + ' ' + item.unit + '</strong></span>' +
              '<span>Min Stok: <strong>' + item.minStock + ' ' + item.unit + '</strong></span>' +
            '</div>' +
          '</div>';
        });
        c.innerHTML = stHtml;
      }
    }

    updateAuthScreens();
    syncWithCloud(false);
    setInterval(function() { syncWithCloud(false); }, 6000);
  </script>
</body>
</html>`;
}

function buildZipAndSignV2(
  entries: { name: string; data: Buffer; compress?: boolean }[],
  privateKeyPem: string,
  certDer: Buffer
): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const uncompressedSize = entry.data.length;
    const crc = crc32(entry.data);
    const useDeflate = Boolean(entry.compress);
    const compressedData = useDeflate ? zlib.deflateRawSync(entry.data) : entry.data;
    const compressedSize = compressedData.length;
    const method = useDeflate ? 8 : 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0x0000, 10);
    localHeader.writeUInt16LE(0x5421, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localChunk = Buffer.concat([localHeader, nameBuf, compressedData]);
    localChunks.push(localChunk);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0x0000, 12);
    centralHeader.writeUInt16LE(0x5421, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt16LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralChunks.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localChunk.length;
  }

  const beforeCentralDir = Buffer.concat(localChunks);
  const centralDir = Buffer.concat(centralChunks);
  const centralDirOffset = beforeCentralDir.length;

  const eocdForDigest = Buffer.alloc(22);
  eocdForDigest.writeUInt32LE(0x06054b50, 0);
  eocdForDigest.writeUInt16LE(0, 4);
  eocdForDigest.writeUInt16LE(0, 6);
  eocdForDigest.writeUInt16LE(entries.length, 8);
  eocdForDigest.writeUInt16LE(entries.length, 10);
  eocdForDigest.writeUInt32LE(centralDir.length, 12);
  eocdForDigest.writeUInt32LE(centralDirOffset, 16);
  eocdForDigest.writeUInt16LE(0, 20);

  const CHUNK_SIZE = 1048576;
  const chunkDigests: Buffer[] = [];
  for (const section of [beforeCentralDir, centralDir, eocdForDigest]) {
    let pos = 0;
    while (pos < section.length) {
      const chunk = section.subarray(pos, Math.min(pos + CHUNK_SIZE, section.length));
      const prefix = Buffer.alloc(5);
      prefix[0] = 0xa5;
      prefix.writeUInt32LE(chunk.length, 1);
      const digest = crypto.createHash('sha256').update(prefix).update(chunk).digest();
      chunkDigests.push(digest);
      pos += chunk.length;
    }
  }

  const topPrefix = Buffer.alloc(5);
  topPrefix[0] = 0x5a;
  topPrefix.writeUInt32LE(chunkDigests.length, 1);
  const topLevelDigest = crypto
    .createHash('sha256')
    .update(topPrefix)
    .update(Buffer.concat(chunkDigests))
    .digest();

  const algIdBuf = Buffer.alloc(4);
  algIdBuf.writeUInt32LE(0x0103, 0);

  const digestEntry = lp32(Buffer.concat([algIdBuf, lp32(topLevelDigest)]));
  const digests = lp32(digestEntry);
  const certificates = lp32(lp32(certDer));
  const additionalAttrs = Buffer.alloc(4, 0);

  const signedData = Buffer.concat([digests, certificates, additionalAttrs]);

  const signatureBytes = crypto.sign('RSA-SHA256', signedData, privateKeyPem);
  const signatureEntry = lp32(Buffer.concat([algIdBuf, lp32(signatureBytes)]));
  const signatures = lp32(signatureEntry);

  const spkiDer = crypto
    .createPublicKey(privateKeyPem)
    .export({ type: 'spki', format: 'der' }) as Buffer;
  const publicKeyField = lp32(spkiDer);

  const signer = Buffer.concat([lp32(signedData), signatures, publicKeyField]);
  const signers = lp32(lp32(signer));

  const v2IdBuf = Buffer.alloc(4);
  v2IdBuf.writeUInt32LE(0x7109871a, 0);
  const v2PairPayload = Buffer.concat([v2IdBuf, signers]);
  const v2PairLenBuf = Buffer.alloc(8);
  v2PairLenBuf.writeBigUInt64LE(BigInt(v2PairPayload.length), 0);
  const v2Pair = Buffer.concat([v2PairLenBuf, v2PairPayload]);

  const blockSizeExcludingFirst8 = BigInt(v2Pair.length + 8 + 16);
  const size64Buf = Buffer.alloc(8);
  size64Buf.writeBigUInt64LE(blockSizeExcludingFirst8, 0);
  const magicBuf = Buffer.from('APK Sig Block 42', 'ascii');

  const apkSigningBlock = Buffer.concat([size64Buf, v2Pair, size64Buf, magicBuf]);

  const finalEocd = Buffer.from(eocdForDigest);
  finalEocd.writeUInt32LE(centralDirOffset + apkSigningBlock.length, 16);

  return Buffer.concat([beforeCentralDir, apkSigningBlock, centralDir, finalEocd]);
}

let cachedCertReady = false;
const KEY_PATH = '/tmp/gudangpresisi_apk_signing_v2.key';
const CRT_PATH = '/tmp/gudangpresisi_apk_signing_v2.crt';
const DER_CRT_PATH = '/tmp/gudangpresisi_apk_signing_v2.der.crt';

function ensureSigningCert() {
  if (
    cachedCertReady &&
    fs.existsSync(KEY_PATH) &&
    fs.existsSync(CRT_PATH) &&
    fs.existsSync(DER_CRT_PATH)
  ) {
    return;
  }
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CRT_PATH}" -days 10000 -nodes -subj "/CN=PT Abadi Agrosindo Persada/OU=Inventory Control Store/O=PT Abadi Agrosindo Persada/L=Sidoarjo/C=ID" 2>/dev/null`
  );
  execSync(`openssl x509 -in "${CRT_PATH}" -outform DER -out "${DER_CRT_PATH}" 2>/dev/null`);
  cachedCertReady = true;
}

export interface GeneratedApkResult {
  apkBuffer: Buffer;
  fileName: string;
  packageName: string;
  versionName: string;
  versionCode: number;
  sha256: string;
  targetUrl: string;
  sizeBytes: number;
  embeddedHtml: string;
}

export function generateSignedWarehouseApk(
  originUrl: string,
  rootDir: string,
  liveServerData?: unknown
): GeneratedApkResult {
  const cleanOrigin = originUrl.replace(/\/+$/, '');
  const internalAssetUrl = 'file:///android_asset/index.html';

  ensureSigningCert();

  const packageName = 'id.gudangpresisi.inventory.mobile';
  const resourcesArsc = buildResourcesArsc(packageName);
  const manifestXml = buildBinaryAndroidManifest(packageName);
  const classesDex = buildClassesDex(internalAssetUrl);
  const embeddedHtml = buildEmbeddedAndroidAppHtml(cleanOrigin, liveServerData);
  const embeddedHtmlBuf = Buffer.from(embeddedHtml, 'utf8');

  const iconPath = path.join(rootDir, 'public', 'pwa-192x192.png');
  const iconData = fs.existsSync(iconPath)
    ? fs.readFileSync(iconPath)
    : Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

  const payloadEntries: { name: string; data: Buffer; compress?: boolean }[] = [
    { name: 'resources.arsc', data: resourcesArsc, compress: false },
    { name: 'AndroidManifest.xml', data: manifestXml, compress: false },
    { name: 'classes.dex', data: classesDex, compress: false },
    { name: 'assets/index.html', data: embeddedHtmlBuf, compress: false },
    { name: 'res/drawable/icon.png', data: iconData, compress: false },
  ];

  const mainAttributes =
    'Manifest-Version: 1.0\r\nCreated-By: 1.0 (Android)\r\n\r\n';
  let manifestMf = mainAttributes;
  const sfEntries: string[] = [];

  for (const entry of payloadEntries) {
    const sha256Base64 = crypto.createHash('sha256').update(entry.data).digest('base64');
    const entryBlock = `Name: ${entry.name}\r\nSHA-256-Digest: ${sha256Base64}\r\n\r\n`;
    manifestMf += entryBlock;

    const entryBlockDigest = crypto
      .createHash('sha256')
      .update(Buffer.from(entryBlock, 'utf8'))
      .digest('base64');
    sfEntries.push(`Name: ${entry.name}\r\nSHA-256-Digest: ${entryBlockDigest}\r\n\r\n`);
  }

  const manifestMfBuf = Buffer.from(manifestMf, 'utf8');
  const mainAttrsDigest = crypto
    .createHash('sha256')
    .update(Buffer.from(mainAttributes, 'utf8'))
    .digest('base64');
  const mainManifestDigest = crypto.createHash('sha256').update(manifestMfBuf).digest('base64');

  const certSf =
    `Signature-Version: 1.0\r\n` +
    `Created-By: 1.0 (Android)\r\n` +
    `SHA-256-Digest-Manifest-Main-Attributes: ${mainAttrsDigest}\r\n` +
    `SHA-256-Digest-Manifest: ${mainManifestDigest}\r\n\r\n` +
    sfEntries.join('');
  const certSfBuf = Buffer.from(certSf, 'utf8');

  const sfTmpPath = '/tmp/gudangpresisi_v2_CERT.SF';
  const rsaTmpPath = '/tmp/gudangpresisi_v2_CERT.RSA';
  fs.writeFileSync(sfTmpPath, certSfBuf);
  execSync(
    `openssl cms -sign -binary -in "${sfTmpPath}" -signer "${CRT_PATH}" -inkey "${KEY_PATH}" -outform DER -out "${rsaTmpPath}" -noattr 2>/dev/null`
  );
  const certRsaBuf = fs.readFileSync(rsaTmpPath);

  const allZipEntries: { name: string; data: Buffer; compress?: boolean }[] = [
    ...payloadEntries,
    { name: 'META-INF/MANIFEST.MF', data: manifestMfBuf, compress: false },
    { name: 'META-INF/CERT.SF', data: certSfBuf, compress: false },
    { name: 'META-INF/CERT.RSA', data: certRsaBuf, compress: false },
  ];

  const privateKeyPem = fs.readFileSync(KEY_PATH, 'utf8');
  const certDer = fs.readFileSync(DER_CRT_PATH);

  const apkBuffer = buildZipAndSignV2(allZipEntries, privateKeyPem, certDer);
  const sha256 = crypto.createHash('sha256').update(apkBuffer).digest('hex');

  return {
    apkBuffer,
    fileName: 'SISTEM-INVENTORY-PT-AAP-v3.0.apk',
    packageName,
    versionName: '3.0.0-SYNC',
    versionCode: 30,
    sha256,
    targetUrl: cleanOrigin,
    sizeBytes: apkBuffer.length,
    embeddedHtml,
  };
}
