// NETWORK.md §6 — lib/e-document/provider.ts İLE AYNI desen: gerçek SNMP/
// ICMP/ARP kütüphanesi Faz 13'ün (Monitoring) parçası olarak bağlanacak,
// bu arayüz bugünden sabitleniyor ki o zaman ÇAĞIRAN kod değişmesin.

export interface DiscoveredDevice {
  ipAddress: string;
  macAddress?: string;
  hostname?: string;
  vendor?: string;
}

export interface NetworkDiscoveryAdapter {
  readonly method: 'SNMP' | 'ICMP' | 'ARP' | 'LLDP' | 'CDP' | 'API' | 'AGENT';
  discover(target: string): Promise<DiscoveredDevice[]>;
}

export class NetworkDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkDiscoveryError';
  }
}

// TODO: MONITORING_COLLECTOR_INTEGRATION — gerçek SNMP/ICMP taraması Faz 13
// ile bağlanacak. Bugün AÇIKÇA reddeder, asla "boş sonuç = cihaz yok" gibi
// yanıltıcı bir sonuç DÖNMEZ (lib/e-document/provider.ts'teki AYNI ilke —
// veri doğruluğu görsel tamlıktan önce gelir).
export class NullDiscoveryAdapter implements NetworkDiscoveryAdapter {
  readonly method = 'ICMP';

  async discover(): Promise<DiscoveredDevice[]> {
    throw new NetworkDiscoveryError('Ağ keşif (discovery) altyapısı henüz yapılandırılmadı — TODO: MONITORING_COLLECTOR_INTEGRATION.');
  }
}

export function resolveNetworkDiscoveryAdapter(_companyId: string): NetworkDiscoveryAdapter {
  return new NullDiscoveryAdapter();
}
