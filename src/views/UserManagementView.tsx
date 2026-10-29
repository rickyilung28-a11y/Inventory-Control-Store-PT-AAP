import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  UserAccount,
  UserRole,
  UserPermissions,
  RoleLevelDefinition,
  PERMISSION_DEFINITIONS,
  getRoleLevel,
  getRoleLabel,
  getRoleShortBadge,
  canManageTargetRole,
  getCreatableRoles,
  getDefaultPermissionsForRole,
  getEffectivePermissions,
} from '../types/inventory';
import {
  UserPlus,
  Key,
  Shield,
  ShieldCheck,
  Edit,
  Trash2,
  CheckCircle,
  Search,
  Eye,
  EyeOff,
  X,
  AlertTriangle,
  Lock,
  Sliders,
  RotateCcw,
  Crown,
  Plus,
  Layers,
} from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const {
    currentUser,
    users,
    createUser,
    updateUser,
    resetUserPassword,
    deleteUser,
    toggleUserStatus,
    reorganizeUsersByLevel,
    roleDefinitions,
    addRoleDefinition,
    updateRoleDefinition,
    deleteRoleDefinition,
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  const actorRole: UserRole = currentUser?.role || 'viewer';
  const isSuperUser = actorRole === 'superuser';
  const creatableRoles = useMemo(
    () => getCreatableRoles(actorRole),
    [actorRole, roleDefinitions]
  );

  // Setiap user hanya dapat melihat tabel user di bawahnya saja (Superuser melihat semua)
  const visibleUsers = useMemo(() => {
    return [...users]
      .filter((u) => (isSuperUser ? true : canManageTargetRole(actorRole, u.role)))
      .sort((a, b) => {
        const diff = getRoleLevel(a.role) - getRoleLevel(b.role);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });
  }, [users, isSuperUser, actorRole, roleDefinitions]);

  const visibleRoleDefinitions = useMemo(() => {
    return roleDefinitions.filter((def) =>
      isSuperUser ? true : canManageTargetRole(actorRole, def.roleKey)
    );
  }, [roleDefinitions, isSuperUser, actorRole]);

  // Modal Tambah / Edit Kategori Level Baru (Khusus Super User)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null);
  const [roleFormKey, setRoleFormKey] = useState('');
  const [roleFormLevel, setRoleFormLevel] = useState<number>(5);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormBadge, setRoleFormBadge] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleFormColor, setRoleFormColor] =
    useState<RoleLevelDefinition['colorTheme']>('cyan');
  const [roleFormPerms, setRoleFormPerms] = useState<UserPermissions>(
    getDefaultPermissionsForRole('user')
  );
  const [roleModalError, setRoleModalError] = useState('');

  // Modal Create
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [newDepartment, setNewDepartment] = useState('MT MTE');
  const [newEmail, setNewEmail] = useState('');
  const [newPermissions, setNewPermissions] = useState<UserPermissions>(
    getDefaultPermissionsForRole('user')
  );
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [createError, setCreateError] = useState('');

  // Modal Reset Password & Edit Username
  const [resetTargetUser, setResetTargetUser] = useState<UserAccount | null>(null);
  const [resetUsernameValue, setResetUsernameValue] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState('');

  // Modal Edit User & Flexible Permissions
  const [editTargetUser, setEditTargetUser] = useState<UserAccount | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editPermissions, setEditPermissions] = useState<UserPermissions>(
    getDefaultPermissionsForRole('user')
  );
  const [editError, setEditError] = useState('');

  // Custom Delete Confirmation Modal (avoids window.confirm)
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserAccount | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const filteredUsers = useMemo(() => {
    return visibleUsers.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      const q = searchQuery.toLowerCase();
      return (
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        getRoleLabel(u.role, isSuperUser).toLowerCase().includes(q)
      );
    });
  }, [visibleUsers, roleFilter, searchQuery, isSuperUser]);

  const getDefaultDeptForRole = (r: UserRole) => {
    switch (r) {
      case 'superuser':
        return 'management';
      case 'kepala_gudang':
        return 'Store';
      case 'admin':
        return 'Store';
      case 'user':
        return 'MT MTE';
      case 'viewer':
        return 'MTE';
      default: {
        const def = roleDefinitions.find((d) => d.roleKey === r);
        return def ? def.name : 'Store';
      }
    }
  };

  const handleOpenAddRoleCategory = () => {
    setEditingRoleKey(null);
    const maxLevel = roleDefinitions.reduce((m, r) => Math.max(m, r.levelNumber), 4);
    setRoleFormLevel(maxLevel + 1);
    setRoleFormKey('');
    setRoleFormName('');
    setRoleFormBadge('');
    setRoleFormDesc('');
    setRoleFormColor('cyan');
    setRoleFormPerms(getDefaultPermissionsForRole('user'));
    setRoleModalError('');
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRoleCategory = (def: RoleLevelDefinition) => {
    setEditingRoleKey(def.roleKey);
    setRoleFormKey(def.roleKey);
    setRoleFormLevel(def.levelNumber);
    setRoleFormName(def.name);
    setRoleFormBadge(def.badgeLabel);
    setRoleFormDesc(def.description);
    setRoleFormColor(def.colorTheme || 'blue');
    setRoleFormPerms({ ...def.defaultPermissions });
    setRoleModalError('');
    setIsRoleModalOpen(true);
  };

  const handleSaveRoleCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setRoleModalError('');
    if (!roleFormName.trim()) {
      setRoleModalError('Nama kategori level wajib diisi.');
      return;
    }
    if (editingRoleKey) {
      const res = updateRoleDefinition(editingRoleKey, {
        levelNumber: roleFormLevel,
        name: roleFormName.trim(),
        badgeLabel:
          roleFormBadge.trim() ||
          `LVL ${roleFormLevel} • ${roleFormName.trim().toUpperCase()}`,
        description: roleFormDesc.trim(),
        colorTheme: roleFormColor,
        defaultPermissions: roleFormPerms,
      });
      if (!res.success) {
        setRoleModalError(res.error || 'Gagal memperbarui kategori level.');
        return;
      }
      setIsRoleModalOpen(false);
    } else {
      const generatedKey =
        roleFormKey.trim() ||
        roleFormName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '');
      const res = addRoleDefinition({
        roleKey: generatedKey,
        levelNumber: roleFormLevel,
        name: roleFormName.trim(),
        badgeLabel:
          roleFormBadge.trim() ||
          `LVL ${roleFormLevel} • ${roleFormName.trim().toUpperCase()}`,
        description:
          roleFormDesc.trim() ||
          `Kategori Level ${roleFormLevel} — ${roleFormName.trim()} pada Sistem Inventory Store.`,
        colorTheme: roleFormColor,
        defaultPermissions: roleFormPerms,
      });
      if (!res.success) {
        setRoleModalError(res.error || 'Gagal menambahkan kategori level baru.');
        return;
      }
      setIsRoleModalOpen(false);
    }
  };

  const handleOpenCreate = (presetRole?: UserRole) => {
    const defaultRole =
      presetRole && creatableRoles.includes(presetRole)
        ? presetRole
        : creatableRoles[0] || 'user';
    setNewUsername('');
    setNewPassword(
      defaultRole === 'superuser'
        ? 'super123'
        : defaultRole === 'kepala_gudang' || defaultRole === 'admin'
        ? 'admin123'
        : defaultRole === 'viewer'
        ? 'view123'
        : 'user123'
    );
    setNewName('');
    setNewRole(defaultRole);
    setNewDepartment(getDefaultDeptForRole(defaultRole));
    setNewEmail('');
    setNewPermissions(getDefaultPermissionsForRole(defaultRole));
    setCreateError('');
    setIsCreateOpen(true);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!newUsername.trim() || !newPassword || !newName.trim()) {
      setCreateError('Username, password, dan nama lengkap wajib diisi.');
      return;
    }

    const res = createUser({
      username: newUsername.trim().toLowerCase().replace(/\s+/g, ''),
      password: newPassword,
      name: newName.trim(),
      role: newRole,
      department: newDepartment.trim(),
      email: newEmail.trim(),
      permissions: newPermissions,
    });

    if (res.success) {
      setIsCreateOpen(false);
    } else if (res.error) {
      setCreateError(res.error);
    }
  };

  const handleOpenResetPassword = (user: UserAccount) => {
    setResetTargetUser(user);
    setResetUsernameValue(user.username);
    setResetPasswordValue(user.password);
    setResetError('');
  };

  const handleSaveResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResetError('');

    const cleanUsername = resetUsernameValue.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanUsername) {
      setResetError('Username tidak boleh kosong.');
      return;
    }

    if (!resetPasswordValue || resetPasswordValue.length < 4) {
      setResetError('Password baru minimal 4 karakter.');
      return;
    }

    const res = resetUserPassword(resetTargetUser.id, resetPasswordValue, cleanUsername);
    if (res.success) {
      setResetTargetUser(null);
    } else if (res.error) {
      setResetError(res.error);
    }
  };

  const handleOpenEdit = (user: UserAccount) => {
    setEditTargetUser(user);
    setEditUsername(user.username);
    setEditName(user.name);
    setEditEmail(user.email || '');
    setEditDepartment(user.department);
    setEditRole(user.role);
    setEditPermissions(getEffectivePermissions(user));
    setEditError('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetUser) return;
    setEditError('');

    const cleanUsername = editUsername.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanUsername || !editName.trim() || !editDepartment.trim()) {
      setEditError('Username, nama lengkap, dan departemen tidak boleh kosong.');
      return;
    }

    const res = updateUser(editTargetUser.id, {
      username: cleanUsername,
      name: editName.trim(),
      email: editEmail.trim(),
      department: editDepartment.trim(),
      role: editRole,
      permissions: editRole === 'superuser' ? getDefaultPermissionsForRole('superuser') : editPermissions,
    });

    if (res.success) {
      setEditTargetUser(null);
    } else if (res.error) {
      setEditError(res.error);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetUser) return;
    const res = deleteUser(deleteTargetUser.id);
    if (res.success) {
      setDeleteTargetUser(null);
      setDeleteError('');
    } else {
      setDeleteError(res.error || 'Gagal menghapus pengguna.');
    }
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return iso;
    }
  };

  // Level user HANYA ditampilkan jika yang login adalah Superuser
  const renderRoleBadge = (role: UserRole) => {
    const def = roleDefinitions.find((r) => r.roleKey === role);
    const lvl = def ? def.levelNumber : getRoleLevel(role);
    const labelName = def ? def.name : getRoleLabel(role, false);
    const displayText = isSuperUser ? `Level ${lvl} • ${labelName}` : labelName;
    const color =
      def?.colorTheme ||
      (role === 'superuser'
        ? 'amber'
        : role === 'kepala_gudang'
        ? 'violet'
        : role === 'admin'
        ? 'emerald'
        : role === 'user'
        ? 'blue'
        : 'slate');

    if (role === 'superuser' || lvl === 0) {
      return (
        <span className="inline-flex items-center gap-1 font-bold text-purple-900 bg-purple-100 px-2.5 py-0.5 rounded-md border border-purple-300 text-[11px]">
          <Crown className="w-3.5 h-3.5 text-purple-700" />
          <span>{displayText}</span>
        </span>
      );
    }
    if (role === 'kepala_gudang' || color === 'violet') {
      return (
        <span className="inline-flex items-center gap-1 font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-md border border-blue-300 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
          <span>{displayText}</span>
        </span>
      );
    }
    if (role === 'admin' || color === 'emerald') {
      return (
        <span className="inline-flex items-center gap-1 font-bold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300 text-[11px]">
          <Shield className="w-3.5 h-3.5 text-emerald-700" />
          <span>{displayText}</span>
        </span>
      );
    }
    if (color === 'cyan') {
      return (
        <span className="inline-flex items-center gap-1 font-bold text-cyan-900 bg-cyan-100 px-2.5 py-0.5 rounded-md border border-cyan-300 text-[11px]">
          <Layers className="w-3.5 h-3.5 text-cyan-700" />
          <span>{displayText}</span>
        </span>
      );
    }
    if (color === 'rose') {
      return (
        <span className="inline-flex items-center gap-1 font-bold text-rose-900 bg-rose-100 px-2.5 py-0.5 rounded-md border border-rose-300 text-[11px]">
          <Layers className="w-3.5 h-3.5 text-rose-700" />
          <span>{displayText}</span>
        </span>
      );
    }
    if (role === 'user' || color === 'amber' || color === 'blue') {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-300 text-[11px]">
          <span>{displayText}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-300 text-[11px]">
        <Eye className="w-3 h-3 text-slate-500" />
        <span>{displayText}</span>
      </span>
    );
  };

  const countByRole = (r: UserRole) => visibleUsers.filter((u) => u.role === r).length;

  const categories = [
    'Stok & Mutasi',
    'Transaksi SIV & LPB',
    'Stok Minimal',
    'Master, User & Audit',
  ] as const;

  const countActivePermissions = (user: UserAccount) => {
    const eff = getEffectivePermissions(user);
    return Object.values(eff).filter(Boolean).length;
  };

  const hasCustomPermissions = (user: UserAccount) => {
    if (user.role === 'superuser' || !user.permissions) return false;
    const def = getDefaultPermissionsForRole(user.role);
    const eff = getEffectivePermissions(user);
    return (Object.keys(def) as (keyof UserPermissions)[]).some((k) => def[k] !== eff[k]);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header & Hierarki Store */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-2xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>
                {isSuperUser
                  ? `Otorisasi Berjenjang Multi-Level (${roleDefinitions.length} Kategori Level) & Hak Akses Fleksibel Store`
                  : 'Manajemen Akun Pengguna di Bawah Wewenang Anda & Hak Akses Fleksibel Store'}
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isSuperUser
                ? 'Manajemen Database User, Kategori Level & Hak Akses Store'
                : 'Manajemen Akun Pengguna & Hak Akses Store'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
              Anda masuk sebagai <strong>{currentUser?.name}</strong> (
              <span className="font-mono font-bold text-slate-900">
                {getRoleShortBadge(actorRole, isSuperUser)}
              </span>
              ).{' '}
              {isSuperUser
                ? 'Sebagai Super User, Anda dapat melihat dan mengatur seluruh level pengguna, menata ulang database user sesuai level, serta menambahkan kategori level baru.'
                : 'Tabel di bawah ini hanya menampilkan daftar akun pengguna yang berada di bawah wewenang Anda.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isSuperUser && (
              <>
                <button
                  type="button"
                  onClick={() => reorganizeUsersByLevel(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-colors shadow-2xs cursor-pointer"
                  title="Urutkan dan sesuaikan seluruh database user beserta hak aksesnya sesuai level"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Atur Ulang Database User Sesuai Level</span>
                </button>
                <button
                  onClick={handleOpenAddRoleCategory}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Kategori Level Baru</span>
                </button>
              </>
            )}
            {creatableRoles.length > 0 && (
              <button
                onClick={() => handleOpenCreate()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>+ Tambah User Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Matriks Kategori Level HANYA muncul untuk akun Superuser */}
        {isSuperUser && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
            {roleDefinitions.map((def) => {
              const cardStyle =
                def.roleKey === 'superuser'
                  ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                  : def.roleKey === 'kepala_gudang'
                  ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                  : def.roleKey === 'admin'
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : def.roleKey === 'user'
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : def.roleKey === 'viewer'
                  ? 'bg-slate-50 border-slate-200 text-slate-900'
                  : 'bg-cyan-50/70 border-cyan-200 text-cyan-950';

              return (
                <div
                  key={def.roleKey}
                  className={`p-3 rounded-xl border flex flex-col justify-between ${cardStyle}`}
                >
                  <div>
                    <div className="font-bold flex items-center justify-between gap-1">
                      <span>
                        Level {def.levelNumber} &bull; {def.name}
                      </span>
                      {def.roleKey === 'superuser' ? (
                        <Crown className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      ) : def.roleKey === 'kepala_gudang' ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                      ) : def.roleKey === 'admin' ? (
                        <Shield className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      ) : (
                        <Layers className="w-3.5 h-3.5 opacity-60 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] opacity-85 mt-1 leading-snug line-clamp-3">
                      {def.description}
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-black/10 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditRoleCategory(def)}
                      className="text-[10px] font-bold underline hover:opacity-80 cursor-pointer"
                    >
                      Edit Level
                    </button>
                    {!def.isSystemDefault && (
                      <button
                        type="button"
                        onClick={() => deleteRoleDefinition(def.roleKey)}
                        className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                      >
                        Hapus Kategori
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filter & Search (Hanya menampilkan role yang boleh dilihat oleh user aktif) */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-3 py-1.5 font-medium rounded-lg transition-colors cursor-pointer ${
                roleFilter === 'ALL'
                  ? 'bg-white shadow-2xs text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isSuperUser ? `Semua Level (${visibleUsers.length})` : `Semua User di Bawah Anda (${visibleUsers.length})`}
            </button>
            {visibleRoleDefinitions.map((def) => (
              <button
                key={def.roleKey}
                onClick={() => setRoleFilter(def.roleKey)}
                className={`px-3 py-1.5 font-medium rounded-lg transition-colors cursor-pointer ${
                  roleFilter === def.roleKey
                    ? 'bg-white shadow-2xs text-slate-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isSuperUser
                  ? `Lvl ${def.levelNumber}: ${def.name} (${countByRole(def.roleKey)})`
                  : `${def.name} (${countByRole(def.roleKey)})`}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari username, nama, divisi..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Mobile Card List (Tampilan Responsif saat dibuka via HP) */}
      <div className="md:hidden space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
            Tidak ada akun pengguna di bawah Anda yang sesuai dengan filter pencarian.
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isCurrent = currentUser?.id === user.id;
            const canManage = canManageTargetRole(actorRole, user.role);
            const activePermCount = countActivePermissions(user);
            const isCustomized = hasCustomPermissions(user);

            return (
              <div
                key={user.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        @{user.username}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">
                          Akun Anda
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-sm text-slate-900 mt-1">{user.name}</div>
                    <div className="text-[11px] text-slate-600">{user.department}</div>
                  </div>
                  {renderRoleBadge(user.role)}
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Password Login:</span>
                    <span className="font-mono font-bold text-slate-800">{user.password}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Hak Akses Aktif:</span>
                    <span className="font-bold text-indigo-700">
                      {activePermCount}/{PERMISSION_DEFINITIONS.length} Akses
                      {isCustomized ? ' (Kustom)' : ''}
                    </span>
                  </div>
                </div>

                {canManage && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => toggleUserStatus(user.id)}
                      disabled={isCurrent}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
                        user.isActive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}
                    >
                      {user.isActive ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Aktif</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-red-600" />
                          <span>Terkunci</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(user)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Edit &amp; Akses</span>
                      </button>
                      <button
                        onClick={() => handleOpenResetPassword(user)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg inline-flex items-center gap-1"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                      {!isCurrent && (
                        <button
                          onClick={() => {
                            setDeleteTargetUser(user);
                            setDeleteError('');
                          }}
                          className="p-1.5 text-red-600 bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop & Tablet Users Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Username &amp; Identitas</th>
                <th className="px-4 py-3">{isSuperUser ? 'Level & Peran' : 'Peran / Jabatan'}</th>
                <th className="px-4 py-3">Departemen</th>
                <th className="px-4 py-3">Hak Akses Fleksibel</th>
                <th className="px-4 py-3">Password &amp; Username</th>
                <th className="px-4 py-3 text-center">Status / Lock Audit</th>
                <th className="px-4 py-3">Login Terakhir</th>
                <th className="px-4 py-3 text-center w-44">Otorisasi Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Tidak ada akun pengguna di bawah Anda yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = currentUser?.id === user.id;
                  const canManage = canManageTargetRole(actorRole, user.role);
                  const activePermCount = countActivePermissions(user);
                  const isCustomized = hasCustomPermissions(user);

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Username & Full Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            @{user.username}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">
                              Akun Anda
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-slate-900 mt-1">{user.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{user.email || '-'}</div>
                      </td>

                      {/* Role (Level only visible for Superuser) */}
                      <td className="px-4 py-3 whitespace-nowrap">{renderRoleBadge(user.role)}</td>

                      {/* Department */}
                      <td className="px-4 py-3 text-slate-700 font-medium">{user.department}</td>

                      {/* Flexible Permissions Summary */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              isCustomized
                                ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            <Sliders className="w-3 h-3 text-indigo-600" />
                            <span>
                              {activePermCount}/{PERMISSION_DEFINITIONS.length} Hak Akses Aktif
                            </span>
                          </span>
                          {isCustomized && (
                            <span className="text-[10px] font-bold text-indigo-700">
                              ✦ Kustomisasi Fleksibel Aktif
                            </span>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(user)}
                              className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                            >
                              Atur Hak Akses &rarr;
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Password & Username Reset */}
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {canManage ? (
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
                              {user.password}
                            </span>
                            <button
                              onClick={() => handleOpenResetPassword(user)}
                              className="text-[11px] text-emerald-700 hover:text-emerald-900 font-sans font-semibold underline cursor-pointer"
                              title="Reset Password atau Edit Username Login"
                            >
                              Reset / Edit
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-sans italic flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Terkunci
                          </span>
                        )}
                      </td>

                      {/* Status / Lock Audit User */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => toggleUserStatus(user.id)}
                          disabled={isCurrent || !canManage}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            user.isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                          } ${
                            isCurrent || !canManage
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer'
                          }`}
                        >
                          {user.isActive ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Aktif (Unlocked)</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-red-600" />
                              <span>Terkunci (Locked)</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3 text-slate-500 text-[11px] font-mono whitespace-nowrap">
                        {formatDateTime(user.lastLogin)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {canManage ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(user)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Edit Username, Peran & Hak Akses Fleksibel"
                            >
                              <Edit className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Edit &amp; Akses</span>
                            </button>

                            <button
                              onClick={() => handleOpenResetPassword(user)}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 rounded-lg transition-colors cursor-pointer"
                              title="Reset Password & Edit Username"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>

                            {!isCurrent && (
                              <button
                                onClick={() => {
                                  setDeleteTargetUser(user);
                                  setDeleteError('');
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Pengguna"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-400 text-[11px] font-medium">
                            <Lock className="w-3 h-3" />
                            <span>Terkunci</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Tambah Pengguna Baru + Hak Akses Fleksibel */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <div>
                  <h2 className="text-base font-bold">
                    Tambah Akun Pengguna Baru (Level di Bawah Anda)
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Daftarkan user baru sekaligus atur hak akses fleksibel sesuai kebutuhan operasional
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveCreate}
              className="p-6 space-y-4 text-xs overflow-y-auto flex-1"
            >
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Username Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) =>
                      setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))
                    }
                    placeholder="Contoh: admin2 / budi2 / view2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Huruf kecil, tanpa spasi
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Password Ditetapkan <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Password login"
                      className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Lengkap Karyawan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Doni Kurniawan"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Email Perusahaan (Opsional)
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nama@pabrik.co.id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Level &amp; Peran Sistem (Di Bawah Level Anda) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const r = e.target.value as UserRole;
                      setNewRole(r);
                      setNewDepartment(getDefaultDeptForRole(r));
                      setNewPermissions(getDefaultPermissionsForRole(r));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold focus:ring-1 focus:ring-slate-900"
                  >
                    {creatableRoles.map((r) => (
                      <option key={r} value={r}>
                        {getRoleLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Departemen / Divisi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="Contoh: Dept. Produksi Line 1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Panel Kustomisasi Hak Akses Fleksibel saat Create */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      <span>Pengaturan Hak Akses Fleksibel ({getRoleLabel(newRole)})</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Centang atau lepaskan hak akses spesifik untuk pengguna ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewPermissions(getDefaultPermissionsForRole(newRole))}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset ke Default Level</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map((cat) => (
                    <div
                      key={cat}
                      className="bg-white p-3 rounded-xl border border-slate-200 space-y-2"
                    >
                      <div className="font-bold text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                        {cat}
                      </div>
                      <div className="space-y-1.5">
                        {PERMISSION_DEFINITIONS.filter((p) => p.category === cat).map((perm) => {
                          const checked = !!newPermissions[perm.key];
                          return (
                            <label
                              key={perm.key}
                              className="flex items-start gap-2 cursor-pointer select-none p-1 rounded hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={newRole === 'superuser'}
                                onChange={(e) =>
                                  setNewPermissions((prev) => ({
                                    ...prev,
                                    [perm.key]: e.target.checked,
                                  }))
                                }
                                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div>
                                <div className="font-semibold text-slate-800 leading-snug">
                                  {perm.label}
                                </div>
                                <div className="text-[10px] text-slate-500 leading-tight">
                                  {perm.description}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Simpan &amp; Daftarkan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reset Password & Edit Username (untuk Level di Bawahnya) */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold">
                  Reset Password &amp; Edit Username
                </h2>
              </div>
              <button
                onClick={() => setResetTargetUser(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResetPassword} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{resetTargetUser.name}</div>
                  <div className="text-slate-500 font-mono text-[11px]">
                    @{resetTargetUser.username} &middot; {resetTargetUser.department}
                  </div>
                </div>
                {renderRoleBadge(resetTargetUser.role)}
              </div>

              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Username Login <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={resetUsernameValue}
                  onChange={(e) =>
                    setResetUsernameValue(e.target.value.toLowerCase().replace(/\s+/g, ''))
                  }
                  placeholder="Username login"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Anda dapat mereset atau mengganti username login akun level di bawah Anda.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Password Baru <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    placeholder="Masukkan password baru (min 4 karakter)"
                    className="w-full px-3 py-2 pr-9 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showResetPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Simpan Username &amp; Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Edit Data Pengguna, Username & Kustomisasi Hak Akses Fleksibel */}
      {editTargetUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <div>
                  <h2 className="text-base font-bold">
                    Edit Akun, Username &amp; Hak Akses Fleksibel
                  </h2>
                  <p className="text-[11px] text-slate-300 font-mono">
                    Target: {editTargetUser.name} (@{editTargetUser.username}) &middot;{' '}
                    {getRoleShortBadge(editTargetUser.role)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditTargetUser(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveEdit}
              className="p-6 space-y-4 text-xs overflow-y-auto flex-1"
            >
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Username Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) =>
                      setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Level &amp; Peran (Role)
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setEditRole(nextRole);
                      setEditPermissions(getDefaultPermissionsForRole(nextRole));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold focus:ring-1 focus:ring-slate-900"
                  >
                    {creatableRoles.map((r) => (
                      <option key={r} value={r}>
                        {getRoleLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Departemen <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Pengaturan Hak Akses Fleksibel */}
              <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      <span>Kustomisasi Hak Akses Fleksibel ({getRoleLabel(editRole)})</span>
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      Sebagai {getRoleShortBadge(actorRole)}, Anda dapat mengaktifkan/menonaktifkan hak akses spesifik untuk akun level di bawah Anda ini.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditPermissions(getDefaultPermissionsForRole(editRole))}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Default Level</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map((cat) => (
                    <div
                      key={cat}
                      className="bg-white p-3 rounded-xl border border-slate-200 space-y-2"
                    >
                      <div className="font-bold text-[11px] uppercase tracking-wider text-indigo-900 border-b border-slate-100 pb-1">
                        {cat}
                      </div>
                      <div className="space-y-1.5">
                        {PERMISSION_DEFINITIONS.filter((p) => p.category === cat).map((perm) => {
                          const checked = !!editPermissions[perm.key];
                          return (
                            <label
                              key={perm.key}
                              className="flex items-start gap-2 cursor-pointer select-none p-1 rounded hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={editRole === 'superuser'}
                                onChange={(e) =>
                                  setEditPermissions((prev) => ({
                                    ...prev,
                                    [perm.key]: e.target.checked,
                                  }))
                                }
                                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div>
                                <div className="font-semibold text-slate-800 leading-snug">
                                  {perm.label}
                                </div>
                                <div className="text-[10px] text-slate-500 leading-tight">
                                  {perm.description}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditTargetUser(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Simpan Perubahan &amp; Hak Akses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Konfirmasi Hapus Pengguna */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Hapus Akun Pengguna Secara Permanen?
                </h3>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Apakah Anda yakin ingin menghapus akun{' '}
                  <strong>{deleteTargetUser.name}</strong> (@{deleteTargetUser.username} &mdash;{' '}
                  {getRoleShortBadge(deleteTargetUser.role)})?
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold shadow-xs cursor-pointer"
              >
                Ya, Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Tambah / Edit Kategori Level Baru (Khusus Super User) */}
      {isRoleModalOpen && isSuperUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <Crown className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-base font-bold">
                    {editingRoleKey
                      ? `Edit Kategori Level — ${roleFormName}`
                      : 'Tambah Kategori Level Jabatan Baru'}
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Super User dapat menambahkan kategori level baru beserta hak akses default untuk sistem Store
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveRoleCategory}
              className="p-6 space-y-4 text-xs overflow-y-auto flex-1"
            >
              {roleModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{roleModalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nomor Urut Level <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={editingRoleKey === 'superuser' ? 0 : 1}
                    max={99}
                    disabled={editingRoleKey === 'superuser'}
                    required
                    value={roleFormLevel}
                    onChange={(e) => setRoleFormLevel(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:ring-1 focus:ring-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Contoh: 1, 2, 3, 4, 5...
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Kategori Level / Jabatan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={roleFormName}
                    onChange={(e) => setRoleFormName(e.target.value)}
                    placeholder="Contoh: Supervisor Store / Checker Store / Koordinator Store"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kode Role (Otomatis/Unik)
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(editingRoleKey)}
                    value={roleFormKey}
                    onChange={(e) => setRoleFormKey(e.target.value)}
                    placeholder="supervisor_store"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Label Badge Singkat
                  </label>
                  <input
                    type="text"
                    value={roleFormBadge}
                    onChange={(e) => setRoleFormBadge(e.target.value)}
                    placeholder={`LVL ${roleFormLevel} • ${roleFormName ? roleFormName.toUpperCase() : 'NAMA LEVEL'}`}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Warna Badge
                  </label>
                  <select
                    value={roleFormColor}
                    onChange={(e) =>
                      setRoleFormColor(e.target.value as RoleLevelDefinition['colorTheme'])
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="cyan">Cyan (Biru Muda)</option>
                    <option value="blue">Blue (Biru)</option>
                    <option value="emerald">Emerald (Hijau)</option>
                    <option value="violet">Violet (Ungu)</option>
                    <option value="amber">Amber (Kuning Emas)</option>
                    <option value="rose">Rose (Merah Muda)</option>
                    <option value="slate">Slate (Abu-abu)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Deskripsi Wewenang Level
                </label>
                <textarea
                  rows={2}
                  value={roleFormDesc}
                  onChange={(e) => setRoleFormDesc(e.target.value)}
                  placeholder="Jelaskan tugas dan cakupan akses kategori level ini..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Default Permissions Matrix for the Role Category */}
              <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-amber-600" />
                      <span>Hak Akses Default untuk Kategori Level Ini</span>
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      Setiap user baru yang didaftarkan dengan kategori level ini akan otomatis mewarisi hak akses di bawah ini.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map((cat) => (
                    <div
                      key={cat}
                      className="bg-white p-3 rounded-xl border border-slate-200 space-y-2"
                    >
                      <div className="font-bold text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
                        {cat}
                      </div>
                      <div className="space-y-1.5">
                        {PERMISSION_DEFINITIONS.filter((p) => p.category === cat).map((perm) => {
                          const checked = !!roleFormPerms[perm.key];
                          return (
                            <label
                              key={perm.key}
                              className="flex items-start gap-2 cursor-pointer select-none p-1 rounded hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={editingRoleKey === 'superuser'}
                                onChange={(e) =>
                                  setRoleFormPerms((prev) => ({
                                    ...prev,
                                    [perm.key]: e.target.checked,
                                  }))
                                }
                                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                              />
                              <div>
                                <div className="font-semibold text-slate-800 leading-snug">
                                  {perm.label}
                                </div>
                                <div className="text-[10px] text-slate-500 leading-tight">
                                  {perm.description}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Simpan Kategori Level
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
