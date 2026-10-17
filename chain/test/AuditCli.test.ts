import { expect } from "chai";
import { resolveAuditRpc, auditRpcLabel } from "../scripts/audit-ledger";
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
});
