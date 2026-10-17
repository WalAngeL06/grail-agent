import { expect } from "chai";
import { resolveAuditRpc, resolveAuditArgs, auditRpcLabel } from "../scripts/audit-ledger";
import { PUBLICNODE_RPC } from "../scripts/lib/audit-ledger";

describe("Audit RPC configuration", function () {
  it("lets --rpc override the audit env, Fuji env and default public endpoint", function () {
    const env = { GRAIL_AUDIT_RPC_URL: "https://audit.example/rpc", FUJI_RPC_URL: "https://fuji.example/rpc" };
    expect(resolveAuditRpc([], {})).to.equal(PUBLICNODE_RPC);
    expect(resolveAuditRpc([], { FUJI_RPC_URL: env.FUJI_RPC_URL })).to.equal(env.FUJI_RPC_URL);
    expect(resolveAuditRpc([], env)).to.equal(env.GRAIL_AUDIT_RPC_URL);
    expect(resolveAuditRpc(["--rpc", "https://cli.example/rpc"], env)).to.equal("https://cli.example/rpc");
    expect(resolveAuditRpc(["--rpc=https://cli.example/rpc"], env)).to.equal("https://cli.example/rpc");
  });

  it("rejects malformed options and non-HTTP RPC URLs before any network read", function () {
    for (const args of [["--rpc"], ["--unknown"], ["--rpc", "file:///tmp/rpc"], ["--rpc", "https://one.example", "--rpc", "https://two.example"]]) {
      expect(() => resolveAuditRpc(args, {})).to.throw();
    }
  });

  it("does not print RPC credentials, private paths or query values in endpoint labels", function () {
    expect(auditRpcLabel("https://user:example-password@rpc.example/private-path?token=example-token"))
      .to.equal("https://rpc.example");
  });

  it("accepts an exact uint256 max-cycle alongside the RPC override", function () {
    expect(resolveAuditArgs(["--max-cycle", "3", "--rpc", "https://cli.example"], {}))
      .to.deep.equal({ rpc: "https://cli.example", maxCycle: 3n });
    expect(resolveAuditArgs(["--max-cycle=9007199254740993"], {}).maxCycle).to.equal(9007199254740993n);
    expect(resolveAuditArgs(["--max-cycle", "0"], {}).maxCycle).to.equal(0n);
    expect(resolveAuditArgs([], {}).maxCycle).to.equal(undefined);
  });

  it("rejects missing, duplicate, negative, fractional or overflowing max-cycle", function () {
    for (const args of [["--max-cycle"], ["--max-cycle", "-1"], ["--max-cycle", "1.5"],
      ["--max-cycle", "3", "--max-cycle", "4"], ["--max-cycle", (2n ** 256n).toString()]]) {
      expect(() => resolveAuditArgs(args, {})).to.throw();
    }
  });
});
