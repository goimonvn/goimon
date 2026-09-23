/**
 * Khai báo tối giản cho Web Bluetooth API. TypeScript lib "dom" mặc định
 * KHÔNG có sẵn các kiểu này (cần gói @types/web-bluetooth chính thức để đầy
 * đủ) — ở đây chỉ khai báo đúng phần `print.service.ts` sử dụng, đủ để
 * typecheck strict mà không cần thêm dependency.
 */

interface BluetoothRemoteGATTCharacteristic {
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice {
  gatt?: BluetoothRemoteGATTServer;
}

interface Bluetooth {
  requestDevice(options: { filters: { services: string[] }[] }): Promise<BluetoothDevice>;
}

interface Navigator {
  bluetooth?: Bluetooth;
}
