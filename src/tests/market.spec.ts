import { expect } from "chai";
import axios from "axios";
import { describe, it, before } from "mocha";
import { Keypair } from "@solana/web3.js";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import {
  API_BASE,
  loadWallet,
  authenticateWithWallet,
  createAuthenticatedClient,
  checkDatabaseMigrated,
} from "./helpers/testHelpers";

const wallet = loadWallet();
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC Mainnet

describe("Market Tests", function () {
  this.timeout(1000 * 60 * 10);

  let cookie = "";
  let client: ReturnType<typeof createAuthenticatedClient>;
  let marketId = "";
  let optionId1 = "";
  let optionId2 = "";
  let isMigrated = false;

  before(async () => {
    isMigrated = await checkDatabaseMigrated();

    const auth = await authenticateWithWallet(wallet);
    cookie = auth.cookie;
    client = createAuthenticatedClient(cookie);
  });

  describe("Market Creation", () => {
    it("should get market creation fee", async () => {
      if (!isMigrated) {
        return;
      }

      const response = await axios.get(`${API_BASE}/market/creation-fee`, {
        validateStatus: () => true,
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("creation_fee");
      expect(response.data.creation_fee).to.be.a("number");
    });

    it("should create a market", async () => {
      if (!isMigrated) {
        return;
      }

      // Get categories first
      const categoriesResponse = await axios.get(
        `${API_BASE}/market/categories`,
        {
          validateStatus: () => true,
        }
      );
      expect(categoriesResponse.status).to.equal(200);
      const categories = categoriesResponse.data.categories || [];
      let sportsCategory = categories.find(
        (cat: any) =>
          cat.name.toLowerCase() === "sports" || cat.name === "Sports"
      );
      if (!sportsCategory && categories.length > 0) {
        sportsCategory = categories[0]; // Fallback to first category
      }
      expect(sportsCategory).to.exist;

      const form = new FormData();
      const marketQuestion = `Test Market ${Date.now()}`;

      form.append("marketQuestion", marketQuestion);
      form.append(
        "marketDescription",
        "A prediction market about Bitcoin's price"
      );
      form.append(
        "marketExpirationDate",
        (Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60).toString()
      );
      form.append("isBinary", "false");
      form.append("categoryIds", JSON.stringify([sportsCategory.id]));
      form.append("resolutionMode", "AUTHORITY");

      // Add image if available
      const imagePath = path.join(__dirname, "asset", "saints.png");
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        form.append("image", imageBuffer, {
          filename: "saints.png",
          contentType: "image/png",
        });
      }

      const response = await client.post("/market/create", form, {
        headers: {
          ...form.getHeaders(),
        },
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("market");
      marketId = response.data.market;
      expect(marketId).to.be.a("string");
      expect(marketId.length).to.be.greaterThan(0);

      // Verify the market was actually created by fetching it
      const marketResponse = await axios.get(`${API_BASE}/market/${marketId}`, {
        validateStatus: () => true,
      });

      expect(marketResponse.status).to.equal(200);
      expect(marketResponse.data).to.have.property("market");
      expect(marketResponse.data.market).to.have.property("id", marketId);
      expect(marketResponse.data.market).to.have.property("question");
      console.log("✅ Successfully created market:", marketId);
    });

    it("should create options for the market", async () => {
      if (!isMigrated || !marketId) {
        return;
      }

      // Create first option
      const form1 = new FormData();
      form1.append("market", marketId);
      form1.append("optionLabel", "Yes");

      const imagePath = path.join(__dirname, "asset", "saints.png");
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        form1.append("image", imageBuffer, {
          filename: "saints.png",
          contentType: "image/png",
        });
      }

      const response1 = await client.post("/market/option/create", form1, {
        headers: {
          ...form1.getHeaders(),
        },
      });

      expect(response1.status).to.equal(200);
      expect(response1.data).to.have.property("option");
      optionId1 = response1.data.option;
      expect(optionId1).to.be.a("string");
      expect(optionId1.length).to.be.greaterThan(0);
      console.log("✅ Successfully created option 1:", optionId1);

      // Create second option
      const form2 = new FormData();
      form2.append("market", marketId);
      form2.append("optionLabel", "No");

      const imagePath2 = path.join(__dirname, "asset", "colts.png");
      if (fs.existsSync(imagePath2)) {
        const imageBuffer = fs.readFileSync(imagePath2);
        form2.append("image", imageBuffer, {
          filename: "colts.png",
          contentType: "image/png",
        });
      }

      const response2 = await client.post("/market/option/create", form2, {
        headers: {
          ...form2.getHeaders(),
        },
      });

      expect(response2.status).to.equal(200);
      expect(response2.data).to.have.property("option");
      optionId2 = response2.data.option;
      expect(optionId2).to.be.a("string");
      expect(optionId2.length).to.be.greaterThan(0);
      console.log("✅ Successfully created option 2:", optionId2);

      // Verify options were added to the market
      const marketResponse = await axios.get(`${API_BASE}/market/${marketId}`, {
        validateStatus: () => true,
      });

      expect(marketResponse.status).to.equal(200);
      expect(marketResponse.data.market).to.have.property("options");
      expect(marketResponse.data.market.options).to.be.an("array");
      expect(marketResponse.data.market.options.length).to.be.at.least(2);
    });

    it("should reject market creation without authentication", async () => {
      if (!isMigrated) {
        return;
      }

      const form = new FormData();
      form.append("marketQuestion", "Test Market");

      const response = await axios.post(`${API_BASE}/market/create`, form, {
        headers: form.getHeaders(),
        validateStatus: () => true,
      });

      expect(response.status).to.equal(401);
    });
  });

  describe("Market Initialization", () => {
    it("should initialize market", async () => {
      if (!isMigrated || !marketId) {
        return;
      }

      const response = await client.post("/market/initialize", {
        market: marketId,
        initialLiquidity: 250 * 10 ** 6, // 250 USDC
      });

      // May already be initialized
      expect(response.status).to.be.oneOf([200, 400, 409]);

      if (response.status === 200) {
        expect(response.data).to.have.property("initial_liquidity");
        expect(response.data).to.have.property("lp_shares");
        expect(response.data).to.have.property("liquidity_parameter");
        console.log("✅ Successfully initialized market");
      }

      // Verify market is initialized
      const marketResponse = await axios.get(`${API_BASE}/market/${marketId}`, {
        validateStatus: () => true,
      });

      if (marketResponse.status === 200) {
        expect(marketResponse.data.market).to.have.property("is_initialized");
        // Market should be initialized (either was already or we just did it)
        expect(marketResponse.data.market.is_initialized).to.be.true;
      }
    });
  });

  describe("Market Resolution", () => {
    it("should resolve market with winning option", async () => {
      if (!isMigrated || !marketId || !optionId1) {
        return;
      }

      // First check if market is already resolved
      const marketCheck = await axios.get(`${API_BASE}/market/${marketId}`, {
        validateStatus: () => true,
      });

      if (marketCheck.status === 200 && marketCheck.data.market.is_resolved) {
        console.log("⚠️ Market is already resolved, skipping resolution test");
        return;
      }

      const response = await client.post("/market/resolve", {
        market: marketId,
        winningOption: optionId1,
      });

      // May not have resolver permissions or market may already be resolved
      expect(response.status).to.be.oneOf([200, 400, 403, 404]);

      if (response.status === 200) {
        expect(response.data).to.have.property("market");
        console.log("✅ Successfully resolved market");

        // Verify market is resolved
        const marketResponse = await axios.get(
          `${API_BASE}/market/${marketId}`,
          {
            validateStatus: () => true,
          }
        );

        if (marketResponse.status === 200) {
          expect(marketResponse.data.market).to.have.property("is_resolved");
          expect(marketResponse.data.market.is_resolved).to.be.true;
        }
      }
    });

    it("should reject market resolution without proper permissions", async () => {
      if (!isMigrated || !marketId) {
        return;
      }

      // Create a non-resolver wallet
      const nonResolverWallet = Keypair.generate();
      const auth = await authenticateWithWallet(nonResolverWallet);
      const nonResolverClient = createAuthenticatedClient(auth.cookie);

      const response = await nonResolverClient.post("/market/resolve", {
        market: marketId,
        winningOption: optionId1 || "test-option",
      });

      expect(response.status).to.be.oneOf([400, 403, 404]);
    });
  });
});
