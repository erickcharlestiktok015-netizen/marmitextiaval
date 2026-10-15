import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoaderCircle, LogOut, MapPin, Phone, Package, Truck } from 'lucide-react';
import { useCourierAuth } from '@/hooks/use-courier-auth';
import { fetchPendingDeliveries, updateDeliveryStatus } from '@/lib/courier-api';
import { Delivery } from '@/types/courier';

export const Route = createFileRoute('/courier')({
  component: CourierRoot,
});

function CourierRoot() {
  const { isAuthenticated, login, logout, isLoading } = useCourierAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setShowDashboard(true);
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoaderCircle className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  if (showDashboard && isAuthenticated) {
    return <CourierDashboard onLogout={logout} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Aplicativo do Motoboy</CardTitle>
          <p className="text-center text-muted-foreground">Marmitex da Tia Val</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            try {
              const success = await login(password);
              if (!success) {
                setError('Senha incorreta');
              }
            } catch {
              setError('Erro ao conectar');
            }
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="courier-password">Senha do Motoboy</Label>
                <Input
                  id="courier-password"
                  type="password"
                  placeholder="Digite a senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={40}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Verificando...' : 'Entrar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

interface CourierDashboardProps {
  onLogout: () => void;
}

function CourierDashboard({ onLogout }: CourierDashboardProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDeliveries();
    const interval = setInterval(loadDeliveries, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDeliveries = async () => {
    try {
      const data = await fetchPendingDeliveries();
      setDeliveries(data);
    } catch {
      setDeliveries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleStatusChange = async (delivery: Delivery, newStatus: 'accepted' | 'collected' | 'delivered') => {
    try {
      await updateDeliveryStatus(delivery.code, newStatus);
      loadDeliveries();
    } catch {
      // Handle error silently
    }
  };

  const getOpenOrders = () => deliveries.filter(d => d.status === 'pending');
  const getActiveOrders = () => deliveries.filter(d => d.status === 'accepted' || d.status === 'collected');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoaderCircle className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Entregas</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            aria-label="Sair"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {getOpenOrders().length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Pendentes</h2>
            <div className="space-y-3">
              {getOpenOrders().map((delivery) => (
                <DeliveryCard
                  key={delivery.code}
                  delivery={delivery}
                  onAccept={() => handleStatusChange(delivery, 'accepted')}
                />
              ))}
            </div>
          </section>
        )}

        {getActiveOrders().length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Em Andamento</h2>
            <div className="space-y-3">
              {getActiveOrders().map((delivery) => (
                <DeliveryCard
                  key={delivery.code}
                  delivery={delivery}
                  status={delivery.status}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </section>
        )}

        {deliveries.length === 0 && !loading && (
          <div className="text-center text-muted-foreground py-8">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma entrega pendente</p>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={loadDeliveries}
          disabled={refreshing}
          className="w-full"
        >
          {refreshing ? (
            <LoaderCircle className="animate-spin h-4 w-4 mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar
        </Button>
      </main>
    </div>
  );
}

interface DeliveryCardProps {
  delivery: Delivery;
  status?: 'pending' | 'accepted' | 'collected' | 'delivered';
  onAccept?: () => void;
  onStatusChange?: (delivery: Delivery, status: 'accepted' | 'collected' | 'delivered') => void;
}

import { RefreshCw } from 'lucide-react';

function DeliveryCard({ delivery, onAccept, onStatusChange, status = delivery.status }: DeliveryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="font-semibold">{delivery.code}</p>
            <p className="text-sm text-muted-foreground">{delivery.customerName}</p>
            <p className="text-sm">{delivery.customerPhone}</p>
          </div>
          <Badge variant={status === 'pending' ? 'secondary' : 'outline'}>
            {status}
          </Badge>
        </div>

        <div className="text-sm space-y-1 mb-3">
          <p className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              {delivery.address}<br />
              {delivery.addressDetails}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Truck className="h-4 w-4 flex-shrink-0" />
            <span>{delivery.distanceKm} km de distância</span>
          </p>
          <p className="flex items-center gap-2">
            <Package className="h-4 w-4 flex-shrink-0" />
            <span>R$ {delivery.total.toFixed(2)}</span>
          </p>
        </div>

        <div className="flex gap-2">
          {status === 'pending' && (
            <Button size="sm" onClick={onAccept} className="flex-1">
              Aceitar
            </Button>
          )}
          {status === 'accepted' && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange?.(delivery, 'collected')}>
              Coletar
            </Button>
          )}
          {status === 'collected' && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange?.(delivery, 'delivered')}>
              Entregar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}