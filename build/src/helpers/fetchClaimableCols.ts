import {
  Address,
  Query,
  ContractFunction,
  AddressValue,
  AbiRegistry,
  ResultsParser
} from '@multiversx/sdk-core';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';

// Minimal ABI fragment for EarnerInfo struct and endpoint
const ABI_JSON = {
  types: {
    EarnerInfo: {
      type: "struct",
      fields: [
        { name: "entity", type: "Address" },
        { name: "entity_info", type: "EntityInfo" },
        { name: "stake_amount", type: "BigUint" },
        { name: "stake_locked_until", type: "u64" },
        { name: "reward_amount", type: "BigUint" }
      ]
    },
    EntityInfo: {
      type: "struct",
      fields: [
        { name: "stake_token", type: "Option<TokenIdentifier>" },
        { name: "reward_token", type: "EgldOrEsdtTokenIdentifier" },
        { name: "lock_time_seconds", type: "u64" },
        { name: "last_reward_at", type: "u64" },
        { name: "last_reward_amount", type: "BigUint" },
        { name: "total_reward_amount", type: "BigUint" },
        { name: "paused", type: "bool" }
      ]
    }
  },
  endpoints: [
    {
      name: "getEarnerInfo",
      mutability: "readonly",
      inputs: [
        { name: "entity", type: "Address" },
        { name: "address", type: "Address" }
      ],
      outputs: [{ type: "EarnerInfo" }]
    }
  ]
};

export async function fetchClaimableCols({
  contract,
  entity,
  user,
  providerUrl
}: {
  contract: string;
  entity: string;
  user: string;
  providerUrl: string;
}): Promise<string> {
  const abiRegistry = AbiRegistry.create(ABI_JSON as any);
  const parser = new ResultsParser();

  const provider = new ProxyNetworkProvider(providerUrl);
  const query = new Query({
    address: new Address(contract),
    func: new ContractFunction("getEarnerInfo"),
    args: [
      new AddressValue(new Address(entity)),
      new AddressValue(new Address(user))
    ]
  });

  const response = await provider.queryContract(query);

  const endpointDef = abiRegistry.getEndpoint("getEarnerInfo");
  const { firstValue } = parser.parseQueryResponse(response, endpointDef);

  if (!firstValue) return "0";
  const rewardAmount = firstValue.valueOf().reward_amount;
  return rewardAmount ? rewardAmount.toString() : "0";
}
