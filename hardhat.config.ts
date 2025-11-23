import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    rootstockTestnet: {
      type: "http",
      url: "https://public-node.testnet.rsk.co",
      accounts: ["2598e686abf8883bc75d45d5ee85f65d5f17477f6358aaa942533d17ea7537fa"],
    },
    xrSepolia: {
      type: "http",
      url: "https://xr-sepolia-testnet.rpc.caldera.xyz/http",
      chainId: 2730,
      accounts: ["2598e686abf8883bc75d45d5ee85f65d5f17477f6358aaa942533d17ea7537fa"],
    },
    // BASE MAINNET - DÙNG PUBLICNODE
    base: {
      type: "http",
      url: "https://base-rpc.publicnode.com",
      chainId: 8453,
      accounts: ["2598e686abf8883bc75d45d5ee85f65d5f17477f6358aaa942533d17ea7537fa"],
      gasPrice: 1000000000, // 1 gwei
    },
    // BASE SEPOLIA TESTNET
    baseSepolia: {
      type: "http",
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: ["2598e686abf8883bc75d45d5ee85f65d5f17477f6358aaa942533d17ea7537fa"],
      gasPrice: 1000000000,
    },
  },
});