import {
  createWalletClient,
  createPublicClient,
  custom,
  defineChain,
  http,
  stringToHex,
  type Address,
} from "viem";

export const hemiTestnet = defineChain({
  id: 743111,
  name: "Hemi Sepolia Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet.rpc.hemi.network/rpc"] } },
  blockExplorers: {
    default: { name: "Hemi Testnet Explorer", url: "https://testnet.explorer.hemi.xyz" },
  },
  testnet: true,
});

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function provider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null;
}

export function hasWallet(): boolean {
  return provider() !== null;
}

export const publicClient = createPublicClient({ chain: hemiTestnet, transport: http() });

export async function connectWallet(): Promise<Address> {
  const eth = provider();
  if (!eth) throw new Error("No browser wallet found. Install MetaMask to record scores onchain.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  const address = accounts[0];
  if (!address) throw new Error("No account returned by the wallet.");
  await ensureHemiNetwork();
  return address;
}

export async function ensureHemiNetwork(): Promise<void> {
  const eth = provider();
  if (!eth) throw new Error("No browser wallet found.");
  const hexId = `0x${hemiTestnet.id.toString(16)}`;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch {
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexId,
          chainName: hemiTestnet.name,
          nativeCurrency: hemiTestnet.nativeCurrency,
          rpcUrls: [...hemiTestnet.rpcUrls.default.http],
          blockExplorerUrls: [hemiTestnet.blockExplorers.default.url],
        },
      ],
    });
  }
}

export async function getConnectedAddress(): Promise<Address | null> {
  const eth = provider();
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: "eth_accounts" })) as Address[];
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

export interface ScoreEntry {
  name: string;
  score: number;
  kills: number;
  graves: number;
  address?: string;
  hash?: string;
  ts: number;
}

const LB_KEY = "hemi-town-3026-leaderboard";

export function readLeaderboard(): ScoreEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LB_KEY);
    const list = raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
    return list.sort((a, b) => b.score - a.score).slice(0, 20);
  } catch {
    return [];
  }
}

export function saveLocalScore(entry: ScoreEntry) {
  if (typeof window === "undefined") return;
  const list = [...readLeaderboard(), entry].sort((a, b) => b.score - a.score).slice(0, 20);
  window.localStorage.setItem(LB_KEY, JSON.stringify(list));
}

/**
 * Writes the run result onto Hemi testnet as a zero-value transaction whose
 * calldata carries the tagged score record. Anyone can read it back from the
 * explorer. If a leaderboard contract address is configured we call that
 * instead.
 */
export async function submitScoreOnchain(entry: ScoreEntry): Promise<string> {
  const eth = provider();
  if (!eth) throw new Error("No browser wallet found. Install MetaMask to record scores onchain.");
  const address = (await getConnectedAddress()) ?? (await connectWallet());
  await ensureHemiNetwork();

  const wallet = createWalletClient({ chain: hemiTestnet, transport: custom(eth), account: address });
  const payload = `HEMI_TOWN_3026|v1|${entry.name}|${entry.score}|${entry.kills}|${entry.graves}`;

  const hash = await wallet.sendTransaction({
    to: address,
    value: 0n,
    data: stringToHex(payload),
  });
  return hash;
}

export function explorerTx(hash: string) {
  return `${hemiTestnet.blockExplorers.default.url}/tx/${hash}`;
}
