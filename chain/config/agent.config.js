/**
 * ERC-8004 Agent Configuration
 *
 * Customize this file to configure your AI agent
 */

module.exports = {
  // Agent Identity
  agent: {
    name: "My AI Agent",
    description: "An AI agent that performs tasks using ERC-8004",
    // IPFS URI containing agent metadata (A2A/MCP endpoints, capabilities, etc.)
    // See: https://eips.ethereum.org/EIPS/eip-8004#agent-registration-file
    metadataURI: "ipfs://YOUR_METADATA_HASH",
  },

  // Task Types & Pricing (in native token - AVAX/ETH)
  tasks: {
    types: [
      { id: 0, name: "Text Summarization", price: "0.001" },
      { id: 1, name: "Code Review", price: "0.005" },
      { id: 2, name: "Data Analysis", price: "0.003" },
      { id: 3, name: "Translation", price: "0.002" },
      { id: 4, name: "Custom", price: "0.01" },
    ],
  },

  // Network Configuration
  networks: {
    fuji: {
      name: "Avalanche Fuji Testnet",
      chainId: 43113,
      rpc: "https://api.avax-test.network/ext/bc/C/rpc",
      explorer: "https://testnet.snowtrace.io",
      registries: {
        // Official ERC-8004 registries — do not override
        identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
        reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
        // Validation Registry is deployed per-agent (set to null)
        validation: null,
      },
    },
    avalanche: {
      name: "Avalanche Mainnet",
      chainId: 43114,
      rpc: "https://api.avax.network/ext/bc/C/rpc",
      explorer: "https://snowtrace.io",
      registries: {
        // Official ERC-8004 registries — do not override
        identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
        reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
        // Validation Registry is deployed per-agent (set to null)
        validation: null,
      },
    },
  },

  // Agent Backend Configuration
  backend: {
    // Polling interval for new tasks (ms)
    pollInterval: 10000,
    // Your AI processing endpoint (called when new task arrives)
    processorEndpoint: "http://localhost:8080/process",
    // Or use a local handler function (see agent-backend/handlers.js)
    useLocalHandler: true,
  },
};
