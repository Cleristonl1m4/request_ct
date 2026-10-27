import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LoginScreen } from '@/components/LoginScreen';
import { AppShell } from '@/components/AppShell';
import type { View } from '@/components/AppShell';
import { Dashboard } from '@/components/Dashboard';
import { RequisicaoDetail } from '@/components/RequisicaoDetail';
import { PermissoesScreen } from '@/components/PermissoesScreen';
import { ShieldAlert, Loader2 } from 'lucide-react';

function AppInner() {
  const { session, user, permissao, nivel, loading } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [editingReqId, setEditingReqId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!session || !user) {
    return <LoginScreen />;
  }

  // Authenticated but without an active permission record
  if (!nivel) {
    return <NoPermissionScreen nome={permissao?.nome_exibicao || user.email || 'Usuário'} />;
  }

  function navigate(v: View) {
    setSelectedReqId(null);
    setEditingReqId(null);
    setView(v);
  }

  function openRequisicao(id: string) {
    setEditingReqId(null);
    setSelectedReqId(id);
    setView('detalhe');
  }

  function editRequisicao(id: string) {
    setEditingReqId(id);
    setView('nova');
  }

  return (
    <AppShell view={view} onNavigate={navigate}>
      {(view === 'dashboard' || view === 'nova') && (
        <Dashboard
          onSelectRequisicao={openRequisicao}
          onEditRequisicao={editRequisicao}
          onNewRequisicao={() => setView('nova')}
          novaAberta={view === 'nova'}
          onCloseNova={() => setView('dashboard')}
          onCreated={(id) => openRequisicao(id)}
          novaRequisicaoId={editingReqId}
        />
      )}
      {view === 'detalhe' && selectedReqId && (
        <RequisicaoDetail
          requisicaoId={selectedReqId}
          onBack={() => setView('dashboard')}
          onEdit={() => editRequisicao(selectedReqId)}
        />
      )}
      {view === 'permissoes' && <PermissoesScreen />}
    </AppShell>
  );
}

function NoPermissionScreen({ nome }: { nome: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert className="w-7 h-7 text-amber-600" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Usuário sem permissão</h1>
        <p className="text-sm text-slate-600 mb-1">
          Olá, <span className="font-medium">{nome}</span>.
        </p>
        <p className="text-sm text-slate-500">
          Sua conta está autenticada, mas ainda não tem um papel atribuído neste sistema.
          Solicite à Diretoria que libere seu acesso definindo seu nível.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
