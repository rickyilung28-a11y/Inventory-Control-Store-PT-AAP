import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  StorageLocation,
  StockItem,
  getEffectivePermissions,
  getRoleHierarchyLevel,
} from '../types/inventory';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Search,
  AlertTriangle,
  X,
  Boxes,
  Barcode,
  FileSpreadsheet,
  ScanBarcode,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { ThermalLabelDesignerModal } from '../components/ThermalLabelDesignerModal';
import { BarcodeScannerLookupModal } from '../components/BarcodeScannerLookupModal';
import { exportStorageLocationsToExcel } from '../utils/sqlAndExcelExport';

interface StorageLocationsViewProps {
  onSelectRackForFilter?: (rackCode: string) => void;
}

export const StorageLocationsView: React.FC<StorageLocationsViewProps> = () => {
  const {
    currentUser,
    stockItems,
    storageLocations,
    addStorageLocation,
    updateStorageLocation,
    deleteStorageLocation,
    locationTransferRequests,
    createLocationTransferRequest,
    approveLocationTransferRequest,
    rejectLocationTransferRequest,
  } = useInventory();

  const perms = getEffectivePermissions(currentUser);
  const canManageLocations = perms.canManageStockItems || perms.canManageCompanyProfile;
  const userLevel = currentUser ? getRoleHierarchyLevel(currentUser.role) : 99;
  const canApproveTransfer =
    userLevel <= 1 ||
    currentUser?.role === 'kepala_gudang' ||
    currentUser?.role === 'superuser';
  const canRequestTransfer =
    canManageLocations ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'kepala_gudang' ||
    currentUser?.role === 'superuser';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');

  // Barcode Printing State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodePreselectedId, setBarcodePreselectedId] = useState<string | undefined>(undefined);

  // Barcode Scanner Lookup Modal State
  const [isScannerLookupOpen, setIsScannerLookupOpen] = useState(false);

  // Location Transfer Request Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferItemId, setTransferItemId] = useState<string>('');
  const [transferTargetRack, setTransferTargetRack] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('');
  const [transferError, setTransferError] = useState<string>('');

  // Reject Transfer Modal State
  const [rejectingTransferId, setRejectingTransferId] = useState<string | null>(null);
  const [rejectTransferReason, setRejectTransferReason] = useState<string>('');

  // Modal Create
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formZone, setFormZone] = useState('Zona A - Sparepart Mesin');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState('');

  // Modal Edit
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);

  // Modal Delete
  const [locationToDelete, setLocationToDelete] = useState<StorageLocation | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Extract unique zones
  const zones = useMemo(() => {
    const list = storageLocations.map((s) => s.zone || 'Zona Umum').filter(Boolean);
    return ['ALL', ...Array.from(new Set(list))];
  }, [storageLocations]);

  // Map items per rack
  const getRackItems = (loc: StorageLocation): StockItem[] => {
    const codeLower = loc.code.trim().toLowerCase();
    const nameLower = loc.name.trim().toLowerCase();
    return stockItems.filter((item) => {
      const itemLoc = item.location.trim().toLowerCase();
      return itemLoc === codeLower || itemLoc === nameLower;
    });
  };

  const filteredLocations = useMemo(() => {
    return storageLocations.filter((loc) => {
      if (selectedZone !== 'ALL' && (loc.zone || 'Zona Umum') !== selectedZone) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const rackItems = getRackItems(loc);
      const matchesRackItem = rackItems.some(
        (i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
      );
      return (
        loc.code.toLowerCase().includes(q) ||
        loc.name.toLowerCase().includes(q) ||
        (loc.zone && loc.zone.toLowerCase().includes(q)) ||
        (loc.description && loc.description.toLowerCase().includes(q)) ||
        matchesRackItem
      );
    });
  }, [storageLocations, selectedZone, searchQuery, stockItems]);

  const pendingTransfers = useMemo(
    () =>
      locationTransferRequests.filter(
        (r) => r.status === 'PENDING_KEPALA' || r.status === 'PENDING_APPROVAL'
      ),
    [locationTransferRequests]
  );

  const handleOpenTransferModal = (preselectedItem?: StockItem) => {
    const item = preselectedItem || stockItems[0];
    setTransferItemId(item?.id || '');
    const otherRack = storageLocations.find((l) => l.code !== item?.location);
    setTransferTargetRack(otherRack?.code || storageLocations[0]?.code || '');
    setTransferReason('');
    setTransferError('');
    setIsTransferModalOpen(true);
  };

  const handleSubmitTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');
    const res = createLocationTransferRequest({
      itemId: transferItemId,
      toLocation: transferTargetRack,
      reason: transferReason,
    });
    if (!res.success) {
      setTransferError(res.error || 'Gagal mengajukan pindah lokasi barang.');
      return;
    }
    setIsTransferModalOpen(false);
  };

  const handleOpenAdd = () => {
    setFormCode('');
    setFormName('');
    setFormZone('Zona A - Sparepart Mesin');
    setFormDesc('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const res = addStorageLocation({
      code: formCode,
      name: formName,
      zone: formZone,
      description: formDesc,
    });

    if (res.success) {
      setIsAddModalOpen(false);
    } else {
      setFormError(res.error || 'Gagal menambahkan lokasi penyimpanan.');
    }
  };

  const handleOpenEdit = (loc: StorageLocation) => {
    setEditingLocation(loc);
    setFormCode(loc.code);
    setFormName(loc.name);
    setFormZone(loc.zone || 'Zona A - Sparepart Mesin');
    setFormDesc(loc.description || '');
    setFormError('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;
    setFormError('');

    const res = updateStorageLocation(editingLocation.id, {
      code: formCode,
      name: formName,
      zone: formZone,
      description: formDesc,
    });

    if (res.success) {
      setEditingLocation(null);
    } else {
      setFormError(res.error || 'Gagal memperbarui lokasi penyimpanan.');
    }
  };

  const handleConfirmDelete = () => {
    if (!locationToDelete) return;
    const res = deleteStorageLocation(locationToDelete.id);
    if (!res.success) {
      setDeleteError(res.error || 'Gagal menghapus lokasi penyimpanan.');
    } else {
      setLocationToDelete(null);
      setDeleteError('');
    }
  };

  const selectedTransferItem = stockItems.find((i) => i.id === transferItemId);

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Sub-Master Lokasi &amp; Rak Penyimpanan Store
            </h2>
            <p className="text-xs text-slate-500">
              Daftar rak penyimpanan Store, fitur Pindah Lokasi Barang (ACC Kepala Store), Scan Barcode Barang &amp; Rak, dan Export Excel.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setIsScannerLookupOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
            title="Scan Barcode Barang (Material Code) atau Barcode Lokasi Rak Store"
          >
            <ScanBarcode className="w-4 h-4" />
            <span>Scan Barcode Barang &amp; Rak</span>
          </button>

          {canRequestTransfer && (
            <button
              type="button"
              onClick={() => handleOpenTransferModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded-lg transition-colors shadow-2xs"
              title="Ajukan pemindahan lokasi rak barang (Terealisasi saat di-ACC Kepala Store)"
            >
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              <span>Ajukan Pindah Lokasi Barang</span>
              {pendingTransfers.length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-extrabold rounded-full text-[10px]">
                  {pendingTransfers.length}
                </span>
              )}
            </button>
          )}

          {(currentUser?.role === 'superuser' ||
            currentUser?.role === 'kepala_gudang' ||
            currentUser?.role === 'admin') && (
            <button
              type="button"
              onClick={() => exportStorageLocationsToExcel(storageLocations, stockItems)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
              title="Export Master Lokasi Rak Store & Rincian Barang ke Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Master Excel</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setBarcodePreselectedId(undefined);
              setIsBarcodeModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-xs"
            title="Preview & Cetak label barcode stiker rak untuk printer thermal Clabel"
          >
            <Barcode className="w-4 h-4 text-slate-950" />
            <span>Preview &amp; Cetak Barcode Rak</span>
          </button>

          {canManageLocations && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>+ Tambah Lokasi / Rak Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Daftar Pengajuan Pindah Lokasi Barang (Menunggu ACC Kepala Store & Riwayat) */}
      {locationTransferRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <ArrowRightLeft className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold flex items-center gap-2">
                  <span>Daftar Pengajuan Pindah Lokasi Rak Barang</span>
                  {pendingTransfers.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                      {pendingTransfers.length} Menunggu ACC Kepala Store
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-300">
                  Pengajuan oleh Admin Store akan otomatis merealisasikan perubahan lokasi rak barang begitu di-ACC oleh Kepala Store.
                </p>
              </div>
            </div>
            {canRequestTransfer && (
              <button
                type="button"
                onClick={() => handleOpenTransferModal()}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold shrink-0 self-start sm:self-auto"
              >
                + Buat Pengajuan Pindah Lokasi
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10.5px]">
                <tr>
                  <th className="px-4 py-2.5">No. Dokumen</th>
                  <th className="px-4 py-2.5">Barang (Material Code)</th>
                  <th className="px-4 py-2.5 text-center">Rak Asal &rarr; Rak Tujuan</th>
                  <th className="px-4 py-2.5">Alasan Pindah</th>
                  <th className="px-4 py-2.5">Diajukan Oleh</th>
                  <th className="px-4 py-2.5 text-center">Status Otorisasi</th>
                  <th className="px-4 py-2.5 text-right">Aksi Kepala Store</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locationTransferRequests.slice(0, 12).map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                      {req.requestNumber || req.transferNumber}
                      <div className="text-[10px] font-normal text-slate-400">
                        {new Date(req.requestedAt).toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 mr-1.5">
                        {req.sku}
                      </span>
                      <span className="font-semibold text-slate-900">{req.itemName}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
                        {req.fromLocation}
                      </span>
                      <span className="mx-1.5 text-indigo-600 font-bold">&rarr;</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                        {req.toLocation}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-xs">{req.reason}</td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium">{req.requestedBy}</td>
                    <td className="px-4 py-2.5 text-center">
                      {req.status === 'PENDING_KEPALA' || req.status === 'PENDING_APPROVAL' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span>Menunggu ACC Kepala Store</span>
                        </span>
                      ) : req.status === 'APPROVED' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Terealisasi (Di-ACC)</span>
                          </span>
                          {req.approvedBy && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Oleh: {req.approvedBy}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-red-100 text-red-800 border border-red-300">
                            <XCircle className="w-3 h-3 text-red-600" />
                            <span>Ditolak</span>
                          </span>
                          {req.rejectionReason && (
                            <div className="text-[10px] text-red-600 mt-0.5">
                              {req.rejectionReason}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {(req.status === 'PENDING_KEPALA' || req.status === 'PENDING_APPROVAL') &&
                      canApproveTransfer ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => approveLocationTransferRequest(req.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ACC &amp; Realisasikan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingTransferId(req.id);
                              setRejectTransferReason('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-[11px]"
                          >
                            Tolak
                          </button>
                        </div>
                      ) : req.status === 'PENDING_KEPALA' || req.status === 'PENDING_APPROVAL' ? (
                        <span className="text-[11px] text-slate-400 italic">
                          Menunggu Kepala Store
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="font-semibold text-slate-500 mr-1 shrink-0">Filter Zona:</span>
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setSelectedZone(z)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                selectedZone === z
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {z === 'ALL' ? 'Semua Zona' : z}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode rak, nama barang, zona..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Table of Storage Locations & Sub-Master Items with Minimum Stock */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3 w-32">Kode Rak</th>
                <th className="px-4 py-3">Nama Lokasi / Rak &amp; Zona Store</th>
                <th className="px-4 py-3">
                  Daftar Barang di Sub-Master Rak &amp; Stock Minimum
                </th>
                <th className="px-4 py-3 text-center w-28">Total Item</th>
                {canManageLocations && <th className="px-4 py-3 text-right w-24">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLocations.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageLocations ? 5 : 4}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Tidak ada lokasi rak yang sesuai dengan pencarian "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredLocations.map((loc) => {
                  const rackItems = getRackItems(loc);
                  const itemCount = rackItems.length;
                  return (
                    <tr key={loc.id} className="hover:bg-slate-50/70 transition-colors align-top">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 rounded text-slate-900 border border-slate-200">
                          {loc.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{loc.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {loc.zone || 'Zona Umum'}
                          </span>
                          {loc.description && (
                            <span className="text-[11px] text-slate-500">{loc.description}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {rackItems.length === 0 ? (
                          <span className="text-slate-400 italic text-[11px]">
                            Belum ada barang terdaftar di rak ini
                          </span>
                        ) : (
                          <div className="space-y-1.5">
                            {rackItems.map((item) => {
                              const isLow = item.currentStock <= item.minStock;
                              const pendingReq = locationTransferRequests.find(
                                (r) => r.itemId === item.id && r.status === 'PENDING_KEPALA'
                              );
                              return (
                                <div
                                  key={item.id}
                                  className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px]"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                    <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                      {item.sku}
                                    </span>
                                    <span className="font-semibold text-slate-800 truncate">
                                      {item.name}
                                    </span>
                                    {pendingReq && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                                        Pending Pindah &rarr; {pendingReq.toLocation}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 font-mono">
                                    <span className="text-slate-600">
                                      Stok:{' '}
                                      <strong className="text-slate-900">
                                        {item.currentStock} {item.unit}
                                      </strong>
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded font-bold border ${
                                        isLow
                                          ? 'bg-red-100 text-red-900 border-red-300'
                                          : 'bg-amber-100 text-amber-950 border-amber-300'
                                      }`}
                                    >
                                      Stock Min: {item.minStock} {item.unit}
                                    </span>
                                    {canRequestTransfer && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenTransferModal(item)}
                                        className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-sans font-semibold text-[10px] inline-flex items-center gap-1"
                                        title="Ajukan Pindah Lokasi Rak untuk barang ini"
                                      >
                                        <ArrowRightLeft className="w-3 h-3" />
                                        <span>Pindah Rak</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                            itemCount > 0
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Boxes className="w-3 h-3" />
                          <span>{itemCount} Item</span>
                        </span>
                      </td>
                      {canManageLocations && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setBarcodePreselectedId(loc.id);
                                setIsBarcodeModalOpen(true);
                              }}
                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Preview & Cetak Barcode Stiker untuk Rak ini (Clabel)"
                            >
                              <Barcode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(loc)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Rak"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLocationToDelete(loc);
                                setDeleteError('');
                              }}
                              disabled={itemCount > 0}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title={
                                itemCount > 0
                                  ? 'Tidak dapat dihapus karena ada barang tersimpan'
                                  : 'Hapus Rak'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajukan Pindah Lokasi Barang */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Ajukan Pindah Lokasi Rak Barang
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Perpindahan lokasi akan terealisasi otomatis setelah di-ACC Kepala Store
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTransfer} className="p-6 space-y-4 text-xs">
              {transferError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-medium">
                  {transferError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Barang (Material Code) yang Akan Dipindahkan <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferItemId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setTransferItemId(id);
                    const found = stockItems.find((i) => i.id === id);
                    if (found) {
                      const nextRack = storageLocations.find((l) => l.code !== found.location);
                      if (nextRack) setTransferTargetRack(nextRack.code);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} — {item.name} (Rak Saat Ini: {item.location})
                    </option>
                  ))}
                </select>
              </div>

              {selectedTransferItem && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-500">Lokasi Rak Saat Ini (Asal):</div>
                    <div className="font-mono font-bold text-sm text-slate-900 mt-0.5">
                      {selectedTransferItem.location}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Saldo Fisik di Rak:</div>
                    <div className="font-mono font-bold text-sm text-emerald-700 mt-0.5">
                      {selectedTransferItem.currentStock} {selectedTransferItem.unit}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lokasi Rak Tujuan Baru <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferTargetRack}
                  onChange={(e) => setTransferTargetRack(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  {storageLocations.map((loc) => (
                    <option
                      key={loc.id}
                      value={loc.code}
                      disabled={loc.code === selectedTransferItem?.location}
                    >
                      {loc.code} — {loc.name} ({loc.zone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan / Keterangan Pemindahan Lokasi <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Contoh: Penataan ulang rak Fast Moving agar lebih dekat pintu distribusi Store..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  Kirim Pengajuan ke Kepala Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tolak Pengajuan Pindah Lokasi */}
      {rejectingTransferId && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Tolak Pengajuan Pindah Lokasi Barang
            </h3>
            <textarea
              rows={3}
              value={rejectTransferReason}
              onChange={(e) => setRejectTransferReason(e.target.value)}
              placeholder="Tuliskan alasan penolakan pindah lokasi rak..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingTransferId(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  rejectLocationTransferRequest(
                    rejectingTransferId,
                    rejectTransferReason || 'Ditolak oleh Kepala Store'
                  );
                  setRejectingTransferId(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Storage Location */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm sm:text-base">Tambah Lokasi / Rak Baru Store</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kode / Nomor Rak <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="Contoh: Rak A-03 atau PALLET-03"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:ring-1 focus:ring-slate-900 focus:outline-hidden uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lokasi / Rak <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Rak A-03 (Kompresor & Selang Angin)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Zona / Area Wilayah Store
                </label>
                <input
                  type="text"
                  value={formZone}
                  onChange={(e) => setFormZone(e.target.value)}
                  placeholder="Contoh: Zona A - Sparepart Mesin"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan / Posisi Fisik (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Contoh: Baris ketiga dekat pintu keluar timur"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Simpan Rak Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Storage Location */}
      {editingLocation && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm sm:text-base">Edit Lokasi / Rak Penyimpanan Store</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingLocation(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kode / Nomor Rak <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:ring-1 focus:ring-slate-900 focus:outline-hidden uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lokasi / Rak <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Zona / Area Wilayah Store
                </label>
                <input
                  type="text"
                  value={formZone}
                  onChange={(e) => setFormZone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan / Posisi Fisik
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLocation(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Rak */}
      {locationToDelete && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 text-xs">
            <div className="w-11 h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 text-center">
              Hapus Lokasi Rak "{locationToDelete.code}"?
            </h3>
            <p className="text-slate-600 text-center mt-1.5">
              Anda yakin ingin menghapus lokasi <strong>{locationToDelete.name}</strong> dari daftar rak penyimpanan Store?
            </p>
            {deleteError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLocationToDelete(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Ya, Hapus Rak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Barcode Stiker Thermal Rak (Clabel & Saved Templates + Preview Sebelum Cetak) */}
      {isBarcodeModalOpen && (
        <ThermalLabelDesignerModal
          locations={
            barcodePreselectedId
              ? storageLocations.filter((l) => l.id === barcodePreselectedId)
              : storageLocations
          }
          initialMode="locations"
          onClose={() => {
            setIsBarcodeModalOpen(false);
            setBarcodePreselectedId(undefined);
          }}
        />
      )}

      {/* Modal Scan Barcode Barang & Lokasi Rak */}
      {isScannerLookupOpen && (
        <BarcodeScannerLookupModal
          isOpen={isScannerLookupOpen}
          onClose={() => setIsScannerLookupOpen(false)}
        />
      )}
    </div>
  );
};
