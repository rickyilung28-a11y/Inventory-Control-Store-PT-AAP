/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { ToastNotification } from './components/ToastNotification';
import { NotificationDrawer } from './components/NotificationDrawer';
import { PrintDocumentModal } from './components/PrintDocumentModal';
import { ApprovalModal } from './components/ApprovalModal';
import { CreateLPBModal } from './components/CreateLPBModal';
import { CreateIssueVoucherModal } from './components/CreateIssueVoucherModal';
import { EditIssueVoucherModal } from './components/EditIssueVoucherModal';
import { BarcodeScannerLookupModal } from './components/BarcodeScannerLookupModal';

import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { LPBView } from './views/LPBView';
import { IssueVoucherListView } from './views/IssueVoucherListView';
import { StockMasterView } from './views/StockMasterView';
import { StockMovementView } from './views/StockMovementView';
import { UserManagementView } from './views/UserManagementView';
import { CostCenterGLView } from './views/CostCenterGLView';
import { StorageLocationsView } from './views/StorageLocationsView';
import { CompanySettingsView } from './views/CompanySettingsView';
import { MinStockManagementView } from './views/MinStockManagementView';
import { SystemActivityLogView } from './views/SystemActivityLogView';
import { SuperuserDatabaseView } from './views/SuperuserDatabaseView';
import { StockOpnameView } from './views/StockOpnameView';
import { PublicAccessModal } from './components/PublicAccessModal';
import { ResetAllModal } from './components/ResetAllModal';
import { SapExportModal } from './components/SapExportModal';
import {
  IssueVoucherDocument,
  getEffectivePermissions,
  getRoleLabel,
  getRoleShortBadge,
} from './types/inventory';
import { downloadSqlBackupFile } from './utils/sqlAndExcelExport';
import { Users, Share2, Database, Lock, ScanBarcode, Download, Trash2, FileSpreadsheet } from 'lucide-react';

function InventoryAppContent() {
  const {
    currentUser,
    roleDefinitions,
    users,
    login,
    logout,
    stockItems,
    lpbDocuments,
    issueVouchers,
    stockMovements,
    minStockProposals,
    stockOpnameSessions,
    activeStockOpname,
    isStockLockedForOpname,
    locationTransferRequests,
    costCenters,
    glAccounts,
    storageLocations,
    companyProfile,
    activityLogs,
    notifications,
    activeToast,
    dismissToast,
    createLPB,
    createIssueVoucher,
    approveIssueVoucher,
    completeIssueVoucherHandover,
    rejectIssueVoucher,
    updateIssueVoucher,
    deleteIssueVoucher,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    selectedDocumentForPrint,
    openPrintPreview,
    closePrintPreview,
    resetToDefaultData,
    resetAllTransactionsAndStock,
  } = useInventory();

  // Active navigation tab
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [ledgerSkuFilter, setLedgerSkuFilter] = useState<string>('');

  // Modals state
  const [isCreateLPBOpen, setIsCreateLPBOpen] = useState(false);
  const [isCreateVoucherOpen, setIsCreateVoucherOpen] = useState(false);
  const [voucherToEdit, setVoucherToEdit] = useState<IssueVoucherDocument | null>(null);
  const [voucherToApprove, setVoucherToApprove] = useState<IssueVoucherDocument | null>(null);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isPublicAccessModalOpen, setIsPublicAccessModalOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isResetAllModalOpen, setIsResetAllModalOpen] = useState(false);
  const [isSapExportModalOpen, setIsSapExportModalOpen] = useState(false);

  // If user is not logged in, always display LoginView first
  if (!currentUser) {
    return (
      <>
        <LoginView />
        <ToastNotification
          toast={activeToast}
          onDismiss={dismissToast}
        />
      </>
    );
  }

  const perms = getEffectivePermissions(currentUser);

  // User tanpa hak canViewAllSIV hanya dapat melihat SIV yang diterbitkan oleh dirinya sendiri
  const visibleIssueVouchers = perms.canViewAllSIV
    ? issueVouchers
    : issueVouchers.filter(
        (v) =>
          v.userId === currentUser.id ||
          v.requestedBy.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      );

  const pendingApprovalsCount = visibleIssueVouchers.filter(
    (v) => v.status === 'PENDING' || v.status === 'APPROVED'
  ).length;

  const handleNavigateToLedgerItem = (sku: string) => {
    if (!perms.canAccessStockMovement) return;
    setLedgerSkuFilter(sku);
    setCurrentTab('ledger');
  };

  const handleViewVoucherFromToast = (voucherNumber: string) => {
    const voucher = visibleIssueVouchers.find((v) => v.voucherNumber === voucherNumber);
    if (voucher) {
      openPrintPreview('NPB', voucher);
    } else {
      setCurrentTab('vouchers');
    }
  };

  const handleSelectVoucherFromNotif = (voucherId: string) => {
    const v = visibleIssueVouchers.find((item) => item.id === voucherId);
    if (v) {
      openPrintPreview('NPB', v);
    }
  };

  const handleSelectLPBFromNotif = (lpbId: string) => {
    const l = lpbDocuments.find((item) => item.id === lpbId);
    if (l) {
      openPrintPreview('LPB', l);
    }
  };

  const handleSwitchUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (target) {
      login(target.username, target.password);
    }
  };

  const handleQuickSqlBackup = () => {
    downloadSqlBackupFile({
      roleDefinitions,
      users,
      stockItems,
      lpbDocuments,
      issueVouchers,
      stockMovements,
      minStockProposals,
      stockOpnameSessions,
      locationTransferRequests,
      costCenters,
      glAccounts,
      storageLocations,
      companyProfile,
      activityLogs,
      notifications,
    });
  };

  const isSuperUser = currentUser.role === 'superuser';
  const canBackupSql =
    isSuperUser || currentUser.role === 'kepala_gudang' || currentUser.role === 'admin';

  return (
    <div className="min-h-dvh w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans overflow-x-hidden transition-colors">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setLedgerSkuFilter('');
          setCurrentTab(tab);
        }}
        currentUser={currentUser}
        allUsers={users}
        onSwitchUser={handleSwitchUser}
        onLogout={logout}
        notifications={notifications}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
        onResetData={() => setIsResetAllModalOpen(true)}
        pendingApprovalsCount={pendingApprovalsCount}
        onSelectSearchItem={perms.canAccessStockMovement ? handleNavigateToLedgerItem : undefined}
        onSelectSearchVoucher={(v) => setVoucherToApprove(v)}
        onOpenBarcodeScanner={() => setIsBarcodeScannerOpen(true)}
      />

      {/* Global Stock Opname Lock Banner */}
      {isStockLockedForOpname && activeStockOpname && (
        <div className="w-full bg-amber-500 text-slate-950 px-3 sm:px-6 lg:px-8 py-2 border-b border-amber-600 no-print">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold">
              <Lock className="w-4 h-4 shrink-0" />
              <span>
                PERHATIAN: Stok Store sedang TER-LOCK karena sesi Stock Opname{' '}
                <strong className="font-mono underline">{activeStockOpname.opnameNumber}</strong> sedang berlangsung (dimulai oleh {activeStockOpname.startedBy}). Penambahan (LPB) &amp; Pengurangan Stok (SIV) dikunci sementara.
              </span>
            </div>
            <button
              onClick={() => setCurrentTab('opname')}
              className="px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-amber-300 font-bold text-[11px] shrink-0 self-start sm:self-auto"
            >
              Buka Stock Opname &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Active User Status Bar */}
      <div className="w-full bg-slate-900 border-b border-slate-800 text-slate-200 text-xs py-2 px-3 sm:px-6 lg:px-8 no-print">
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span className="text-slate-300 truncate sm:whitespace-normal">
              Pengguna Aktif: <strong className="text-white">{currentUser.name}</strong> (@
              {currentUser.username}) &middot;{' '}
              <span
                className={
                  currentUser.role === 'superuser'
                    ? 'text-purple-400 font-bold'
                    : currentUser.role === 'kepala_gudang'
                    ? 'text-blue-400 font-bold'
                    : currentUser.role === 'admin'
                    ? 'text-emerald-400 font-bold'
                    : currentUser.role === 'user'
                    ? 'text-amber-400 font-semibold'
                    : 'text-slate-300 font-semibold'
                }
              >
                {getRoleLabel(currentUser.role, isSuperUser)} &mdash; {currentUser.department}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsBarcodeScannerOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 sm:py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 text-[11px] font-semibold transition-colors cursor-pointer"
              title="Scan Barcode Barang (Material Code) atau Barcode Lokasi Rak Store"
            >
              <ScanBarcode className="w-3 h-3 text-indigo-300" />
              <span>Scan Barcode Barang &amp; Rak</span>
            </button>

            {canBackupSql && (
              <button
                onClick={() => setIsSapExportModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 sm:py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-[11px] font-bold transition-colors cursor-pointer"
                title="Export Excel (.xlsx) & CSV (.csv) untuk Import Sistem SAP (SIV Mvt 201, LPB Mvt 101/501, Material Master MB52)"
              >
                <FileSpreadsheet className="w-3 h-3 text-amber-300" />
                <span>Export SAP (.xlsx / .csv)</span>
              </button>
            )}

            {canBackupSql && (
              <>
                <button
                  onClick={handleQuickSqlBackup}
                  className="inline-flex items-center gap-1 px-2.5 py-1 sm:py-0.5 rounded bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-400/40 text-[11px] font-semibold transition-colors cursor-pointer"
                  title="Download Backup Database SQL (.sql) untuk Server Mandiri"
                >
                  <Download className="w-3 h-3 text-teal-300" />
                  <span>Backup SQL (.sql)</span>
                </button>

                <button
                  onClick={() => setIsResetAllModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 sm:py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/40 text-[11px] font-bold transition-colors cursor-pointer"
                  title="Reset All — Kosongkan kembali semua transaksi LPB, Stok Barang, dan Nota SIV"
                >
                  <Trash2 className="w-3 h-3 text-red-300" />
                  <span>Reset All (Kosongkan)</span>
                </button>
              </>
            )}

            <button
              onClick={() => setIsPublicAccessModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition-colors cursor-pointer"
              title="Salin Link Login Aplikasi & QR Code untuk dibagikan ke pengguna lain"
            >
              <Share2 className="w-3 h-3 text-emerald-400" />
              <span>Link Login &amp; QR Code</span>
            </button>

            {isSuperUser && (
              <button
                onClick={() => setCurrentTab('superuser-db')}
                className="inline-flex items-center gap-1 px-2.5 py-1 sm:py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] transition-colors cursor-pointer"
              >
                <Database className="w-3 h-3" />
                <span>Database Superuser &amp; SQL</span>
              </button>
            )}

            {perms.canManageLowerUsers && (
              <button
                onClick={() => setCurrentTab('users')}
                className="inline-flex items-center gap-1 px-2.5 py-1 sm:py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-[11px] transition-colors cursor-pointer"
              >
                <Users className="w-3 h-3" />
                <span>
                  {isSuperUser
                    ? `Kelola User & Level (${getRoleShortBadge(currentUser.role, true)})`
                    : `Kelola User (${getRoleShortBadge(currentUser.role, false)})`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area (Responsive Fullscreen on both Desktop Computer & Mobile Phone) */}
      <main className="flex-1 w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            onOpenCreateLPB={() => setIsCreateLPBOpen(true)}
            onOpenCreateVoucher={() => setIsCreateVoucherOpen(true)}
            onOpenApproval={(v) => setVoucherToApprove(v)}
            onPrintDocument={(type, doc) => openPrintPreview(type, doc)}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'lpb' && (perms.canCreateLPB || perms.canApproveLPBStockAddition) && (
          <LPBView
            currentUser={currentUser}
            lpbDocuments={lpbDocuments}
            onOpenCreateLPB={() => setIsCreateLPBOpen(true)}
            onPrintLPB={(doc) => openPrintPreview('LPB', doc)}
          />
        )}

        {currentTab === 'vouchers' &&
          (perms.canCreateSIV ||
            perms.canViewAllSIV ||
            perms.canValidateSIV ||
            perms.canApproveSIVStockDeduction) && (
            <IssueVoucherListView
              currentUser={currentUser}
              issueVouchers={visibleIssueVouchers}
              onOpenCreateVoucher={() => setIsCreateVoucherOpen(true)}
              onOpenEditVoucher={(v) => setVoucherToEdit(v)}
              onOpenApproval={(v) => setVoucherToApprove(v)}
              onDeleteVoucher={(id) => deleteIssueVoucher(id)}
              onPrintVoucher={(doc) => openPrintPreview('NPB', doc)}
            />
          )}

        {currentTab === 'items' && (
          <StockMasterView
            onViewLedgerItem={handleNavigateToLedgerItem}
            onNavigateToMinStock={
              perms.canProposeMinStock ||
              perms.canVerifyMinStock ||
              perms.canApproveMinStockSystem
                ? () => setCurrentTab('min-stock')
                : undefined
            }
          />
        )}

        {currentTab === 'opname' && <StockOpnameView />}

        {currentTab === 'min-stock' &&
          (perms.canProposeMinStock ||
            perms.canVerifyMinStock ||
            perms.canApproveMinStockSystem) && (
            <MinStockManagementView
              onNavigateToLPB={() => setIsCreateLPBOpen(true)}
              onNavigateToStockMaster={() => setCurrentTab('items')}
            />
          )}

        {currentTab === 'ledger' && perms.canAccessStockMovement && (
          <StockMovementView preselectedSku={ledgerSkuFilter} />
        )}

        {currentTab === 'activity-log' && perms.canViewLowerAuditLogs && (
          <SystemActivityLogView />
        )}

        {currentTab === 'locations' &&
          (perms.canManageCompanyProfile || perms.canManageStockItems) && (
            <StorageLocationsView
              onSelectRackForFilter={() => {
                setCurrentTab('items');
              }}
            />
          )}

        {currentTab === 'company' && perms.canManageCompanyProfile && (
          <CompanySettingsView />
        )}

        {currentTab === 'users' && perms.canManageLowerUsers && (
          <UserManagementView />
        )}

        {currentTab === 'accounting' && perms.canManageCostCenterGL && (
          <CostCenterGLView />
        )}

        {currentTab === 'superuser-db' && currentUser.role === 'superuser' && (
          <SuperuserDatabaseView onNavigateTab={(tab) => setCurrentTab(tab)} />
        )}
      </main>

      {/* Modals & Drawers */}
      {isCreateLPBOpen && perms.canCreateLPB && (
        <CreateLPBModal
          stockItems={stockItems}
          onClose={() => setIsCreateLPBOpen(false)}
          onSubmit={createLPB}
          onSuccessPrint={(doc) => openPrintPreview('LPB', doc)}
        />
      )}

      {isCreateVoucherOpen && perms.canCreateSIV && (
        <CreateIssueVoucherModal
          stockItems={stockItems}
          currentUser={currentUser}
          onClose={() => setIsCreateVoucherOpen(false)}
          onSubmit={createIssueVoucher}
          onSuccessPrint={(doc) => openPrintPreview('NPB', doc)}
        />
      )}

      {voucherToEdit && (
        <EditIssueVoucherModal
          voucher={voucherToEdit}
          stockItems={stockItems}
          onClose={() => setVoucherToEdit(null)}
          onSubmit={updateIssueVoucher}
        />
      )}

      {voucherToApprove && (
        <ApprovalModal
          voucher={voucherToApprove}
          stockItems={stockItems}
          currentAdminName={currentUser.name}
          currentUserRole={currentUser.role}
          currentUser={currentUser}
          onClose={() => setVoucherToApprove(null)}
          onApprove={(handover) => {
            approveIssueVoucher(voucherToApprove.id, handover);
            setVoucherToApprove(null);
          }}
          onCompleteHandover={(handoverData) => {
            const res = completeIssueVoucherHandover(voucherToApprove.id, handoverData);
            if (res.success) {
              setVoucherToApprove(null);
            }
            return res;
          }}
          onReject={(reason) => {
            rejectIssueVoucher(voucherToApprove.id, reason);
            setVoucherToApprove(null);
          }}
        />
      )}

      {selectedDocumentForPrint && (
        <PrintDocumentModal
          documentData={selectedDocumentForPrint}
          onClose={closePrintPreview}
        />
      )}

      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={notifications}
        currentUserId={currentUser.id}
        currentUserRole={currentUser.role}
        onMarkAsRead={markNotificationAsRead}
        onMarkAllAsRead={markAllNotificationsAsRead}
        onSelectVoucher={handleSelectVoucherFromNotif}
        onSelectLPB={handleSelectLPBFromNotif}
      />

      <PublicAccessModal
        isOpen={isPublicAccessModalOpen}
        onClose={() => setIsPublicAccessModalOpen(false)}
      />

      {isBarcodeScannerOpen && (
        <BarcodeScannerLookupModal
          isOpen={isBarcodeScannerOpen}
          onClose={() => setIsBarcodeScannerOpen(false)}
        />
      )}

      <ResetAllModal
        isOpen={isResetAllModalOpen}
        onClose={() => setIsResetAllModalOpen(false)}
        stats={{
          stockCount: stockItems.length,
          lpbCount: lpbDocuments.length,
          sivCount: issueVouchers.length,
          movementCount: stockMovements.length,
          opnameCount: stockOpnameSessions.length,
        }}
        onResetAllEmpty={() => resetAllTransactionsAndStock('EMPTY_ALL')}
        onResetTransactionsZeroStock={() => resetAllTransactionsAndStock('ZERO_STOCK_ONLY')}
        onRestoreDemoData={resetToDefaultData}
      />

      {canBackupSql && isSapExportModalOpen && (
        <SapExportModal
          isOpen={isSapExportModalOpen}
          onClose={() => setIsSapExportModalOpen(false)}
          defaultModule="ALL_SAP_SHEETS"
          vouchers={visibleIssueVouchers}
          lpbDocs={lpbDocuments}
          stockItems={stockItems}
          costCenters={costCenters}
          glAccounts={glAccounts}
        />
      )}

      <ToastNotification
        toast={activeToast}
        onDismiss={dismissToast}
        onViewVoucher={handleViewVoucherFromToast}
      />

      {/* Footer */}
      <footer className="mt-auto w-full border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 text-xs text-slate-500 dark:text-slate-400 no-print transition-colors">
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span>&copy; 2026 PT. Abadi Agrosindo Persada. Sistem Manajemen Store &amp; Inventaris.</span>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-slate-400">
            <button
              onClick={() => setIsPublicAccessModalOpen(true)}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-semibold flex items-center gap-1"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Link Login Aplikasi</span>
            </button>
            <span>&middot;</span>
            <span>
              {isSuperUser
                ? 'Hierarki Otorisasi Multi-Level & Database SQL Store'
                : 'Sistem Otorisasi & Manajemen Inventaris Store'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <InventoryProvider>
        <InventoryAppContent />
      </InventoryProvider>
    </ThemeProvider>
  );
}
