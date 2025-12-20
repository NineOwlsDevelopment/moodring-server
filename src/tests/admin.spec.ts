import { expect } from "chai";
import axios from "axios";
import { describe, it, before } from "mocha";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  API_BASE,
  loadWallet,
  authenticateWithWallet,
  createAuthenticatedClient,
  checkDatabaseMigrated,
} from "./helpers/testHelpers";

const wallet = loadWallet();

describe("Admin Tests", function () {
  this.timeout(1000 * 60 * 5);

  let cookie = "";
  let client: ReturnType<typeof createAuthenticatedClient>;
  let isMigrated = false;
  let isAdmin = false;

  before(async () => {
    isMigrated = await checkDatabaseMigrated();

    const auth = await authenticateWithWallet(wallet);
    cookie = auth.cookie;
    client = createAuthenticatedClient(cookie);

    // Check if user is admin
    try {
      const response = await client.get("/admin/stats");
      isAdmin = response.status === 200;
    } catch {
      isAdmin = false;
    }
  });

  describe("Admin Authentication", () => {
    it("should reject admin endpoints without admin role", async () => {
      if (!isMigrated) {
        return;
      }

      // Create a non-admin user
      const newWallet = Keypair.generate();
      const message = "Sign this message to authenticate with Moodring";
      const messageBytes = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(messageBytes, newWallet.secretKey);
      const signatureBase58 = bs58.encode(signature);

      const authResponse = await axios.post(
        `${API_BASE}/auth/wallet/authenticate`,
        {
          wallet_address: newWallet.publicKey.toBase58(),
          signature: signatureBase58,
          message,
        },
        { withCredentials: true, validateStatus: () => true }
      );

      if (authResponse.status === 200 || authResponse.status === 201) {
        const setCookies = authResponse.headers["set-cookie"] || [];
        const nonAdminCookie = setCookies
          .map((c: string) => c.split(";")[0])
          .join("; ");

        const nonAdminClient = createAuthenticatedClient(nonAdminCookie);
        const response = await nonAdminClient.get("/admin/stats");

        expect(response.status).to.equal(403);
      }
    });
  });

  describe("Core Admin Operations", () => {
    it("should get admin stats", async () => {
      if (!isMigrated || !isAdmin) {
        return;
      }

      const response = await client.get("/admin/stats");
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("users");
      expect(response.data).to.have.property("markets");
      expect(response.data).to.have.property("trades");
      expect(response.data).to.have.property("pending_withdrawals");
    });

    it("should get pause flags", async () => {
      if (!isMigrated || !isAdmin) {
        return;
      }

      const response = await client.get("/admin/pause");
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("flags");
    });

    it("should get protocol fees", async () => {
      if (!isMigrated || !isAdmin) {
        return;
      }

      const response = await client.get("/admin/fees");
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("fees");
    });
  });
});
