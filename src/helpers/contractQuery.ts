/**
 * Adapter for SDK v5 compatibility
 * The IAddress interface from sdk-network-providers expects bech32() method,
 * but the Address class from sdk-core has toBech32() method.
 */

import { Address, ContractFunction, TypedValue } from '@multiversx/sdk-core';
import type { IContractQuery, IAddress } from '@multiversx/sdk-network-providers/out/interface';
import { AddressValue, BigUIntValue, U64Value, BytesValue, BooleanValue, StringValue } from '@multiversx/sdk-core/out/abi';

/**
 * Wrapper for Address that implements IAddress interface
 */
export class AddressAdapter implements IAddress {
  private address: Address;

  constructor(address: Address) {
    this.address = address;
  }

  bech32(): string {
    return this.address.toBech32();
  }

  /**
   * Get the underlying Address object
   */
  getAddress(): Address {
    return this.address;
  }
}

/**
 * Encode a TypedValue to hex string for contract query
 */
function encodeTypedValue(value: TypedValue): string {
  // Handle AddressValue - encode as 32-byte pubkey in hex
  if (value instanceof AddressValue) {
    const addr = value.valueOf(); // Returns Address
    const pubkey = addr.getPublicKey(); // Returns Buffer (32 bytes)
    return pubkey.toString('hex');
  }
  
  // Handle BigUIntValue - encode as big-endian bytes in hex
  if (value instanceof BigUIntValue) {
    const bn = value.valueOf(); // Returns BigNumber
    // Convert to Buffer with proper encoding
    let hex = bn.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    const buffer = Buffer.from(hex, 'hex');
    return buffer.toString('hex');
  }
  
  // Handle U64Value
  if (value instanceof U64Value) {
    const bn = value.valueOf();
    let hex = bn.toString(16);
    // Pad to 8 bytes (64 bits)
    while (hex.length < 16) hex = '0' + hex;
    const buffer = Buffer.from(hex, 'hex');
    return buffer.toString('hex');
  }
  
  // Handle BytesValue
  if (value instanceof BytesValue) {
    const buffer = value.valueOf(); // Returns Buffer
    return buffer.toString('hex');
  }
  
  // Handle StringValue
  if (value instanceof StringValue) {
    const str = value.valueOf();
    return Buffer.from(str).toString('hex');
  }
  
  // Handle BooleanValue
  if (value instanceof BooleanValue) {
    const bool = value.valueOf();
    return bool ? Buffer.from([1]).toString('hex') : Buffer.from([0]).toString('hex');
  }
  
  // Generic fallback: try to get Buffer or convert to bytes
  const raw = value.valueOf();
  if (Buffer.isBuffer(raw)) {
    return raw.toString('hex');
  }
  if (raw && typeof raw.getPublicKey === 'function') {
    // It's an Address
    return raw.getPublicKey().toString('hex');
  }
  if (typeof raw === 'string') {
    return Buffer.from(raw).toString('hex');
  }
  if (typeof raw === 'bigint' || typeof raw === 'number') {
    let hex = raw.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    return Buffer.from(hex, 'hex').toString('hex');
  }
  
  // Last resort - JSON encode
  console.warn('Unknown TypedValue type, using JSON fallback:', value);
  return Buffer.from(JSON.stringify(raw)).toString('hex');
}

/**
 * Simplifies creating a contract query using Address objects directly
 * This uses the new SmartContractQuery from sdk-core
 */
export async function createSmartContractQuery(params: {
  contract: Address;
  function: string;
  arguments?: Uint8Array[];
  caller?: Address;
  value?: bigint;
}): Promise<any> {
  // SmartContractQuery expects Uint8Array[] for arguments
  return {
    contract: params.contract,
    function: params.function,
    arguments: params.arguments || [],
    caller: params.caller,
    value: params.value
  };
}

/**
 * Wraps a Query-like object to make it compatible with IContractQuery
 */
export class ContractQueryAdapter implements IContractQuery {
  private _address: AddressAdapter;
  private _caller?: AddressAdapter;
  private _func: { toString(): string };
  private _args: string[];
  private _value?: string;

  constructor(params: {
    address: Address;
    func: ContractFunction | { toString(): string };
    args?: TypedValue[];
    caller?: Address;
    value?: bigint;
  }) {
    this._address = new AddressAdapter(params.address);
    this._caller = params.caller ? new AddressAdapter(params.caller) : undefined;
    this._func = params.func;
    this._args = (params.args || []).map(encodeTypedValue);
    this._value = params.value?.toString();
  }

  get address(): IAddress {
    return this._address;
  }

  get caller(): IAddress | undefined {
    return this._caller;
  }

  get func(): { toString(): string } {
    return this._func;
  }

  get value(): { toString(): string } | undefined {
    return this._value ? { toString: () => this._value! } : undefined;
  }

  getEncodedArguments(): string[] {
    return this._args;
  }
}

/**
 * Creates an IContractQuery-compatible object from Address and ContractFunction
 * This adapter bridges the gap between sdk-core's Query class and
 * sdk-network-providers' IContractQuery interface.
 */
export function createContractQuery(params: {
  address: Address;
  func: ContractFunction;
  args?: TypedValue[];
  caller?: Address;
  value?: bigint;
}): IContractQuery {
  return new ContractQueryAdapter(params);
}

/**
 * Alternative: Create a simple query object that satisfies IContractQuery
 * Using raw strings and pre-encoded arguments
 */
export function createSimpleQuery(params: {
  address: string;
  func: string;
  args?: string[]; // base64-encoded arguments
  caller?: string;
  value?: string;
}): IContractQuery {
  const caller = params.caller;
  const value = params.value;
  return {
    address: {
      bech32: () => params.address
    },
    caller: caller ? { bech32: () => caller } : undefined,
    func: { toString: () => params.func },
    value: value ? { toString: () => value } : undefined,
    getEncodedArguments: () => params.args || []
  };
}