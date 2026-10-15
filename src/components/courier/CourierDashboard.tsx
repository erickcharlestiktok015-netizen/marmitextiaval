import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { endCourierSession, getCourierSession } from '@/lib/courier/session';
import { fetchPendingOrders } from '@/lib/courier/orders';
import { Order } from '@/lib/orders';

export function CourierDashboard({ onLogout }: { onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await fetchPendingOrders();
      setOrders(data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await endCourierSession();
    onLogout();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle>Entregas Pendentes</CardTitle>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Sair
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : orders.length === 0 ? (
        <p className="text-center text-muted-foreground">Nenhuma entrega pendente.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.code}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">#{order.code}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.customer.name} - {order.customer.phone}
                    </p>
                    <p className="text-sm">
                      {order.address?.street}, {order.address?.numero} - {order.address?.bairro}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {order.distanceKm} km
                  </Badge>
                </div>
                <div className="mt-2">
                  <Button size="sm" className="w-full">
                    Aceitar Entrega
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}