import { GradientDivider } from "@/components/brand";

export const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-graphite-deep">
      <div className="section-container py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Terms of Service
            </h1>
            <p className="text-moon-grey text-sm">
              Last updated:{" "}
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <GradientDivider className="mt-6" />
          </div>

          {/* Content */}
          <div className="prose prose-invert prose-lg max-w-none">
            <div className="space-y-8 text-moon-grey leading-relaxed">
              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  1. Acceptance of Terms
                </h2>
                <p>
                  By accessing and using Moodring ("the Platform", "we", "us",
                  or "our"), you accept and agree to be bound by these Terms of
                  Service ("Terms"). If you do not agree to these Terms, you
                  must not use the Platform. These Terms constitute a legally
                  binding agreement between you and Moodring.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  2. Description of Service
                </h2>
                <p>
                  Moodring is a decentralized prediction market platform built
                  on the Solana blockchain. The Platform allows users to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Create and participate in prediction markets</li>
                  <li>Trade shares in market outcomes</li>
                  <li>Provide liquidity to markets</li>
                  <li>Resolve markets based on real-world events</li>
                </ul>
                <p className="mt-4">
                  The Platform operates using smart contracts on the Solana
                  blockchain. All transactions are executed on-chain and are
                  irreversible once confirmed.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  3. Eligibility
                </h2>
                <p>To use the Platform, you must:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    Be at least 18 years old (or the age of majority in your
                    jurisdiction)
                  </li>
                  <li>
                    Have the legal capacity to enter into binding agreements
                  </li>
                  <li>
                    Not be located in a jurisdiction where prediction markets
                    are prohibited
                  </li>
                  <li>
                    Comply with all applicable laws and regulations in your
                    jurisdiction
                  </li>
                  <li>
                    Not be subject to any sanctions or restrictions imposed by
                    your jurisdiction
                  </li>
                </ul>
                <p className="mt-4">
                  You are solely responsible for determining whether your use of
                  the Platform is legal in your jurisdiction.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  4. Wallet Connection and Account Security
                </h2>
                <p>
                  The Platform requires connection to a Solana-compatible
                  cryptocurrency wallet. You are solely responsible for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    Maintaining the security and confidentiality of your wallet
                    private keys
                  </li>
                  <li>All activities that occur under your wallet address</li>
                  <li>
                    Ensuring your wallet is properly secured and backed up
                  </li>
                  <li>Verifying all transactions before confirming them</li>
                </ul>
                <p className="mt-4">
                  Moodring does not store, have access to, or control your
                  private keys. We are not responsible for any loss of funds
                  resulting from compromised wallet security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  5. Market Creation and Participation
                </h2>
                <p>When creating or participating in markets, you agree to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    Create markets only for events that are resolvable and
                    verifiable
                  </li>
                  <li>
                    Not create markets for illegal activities or events that
                    violate third-party rights
                  </li>
                  <li>
                    Not manipulate markets or engage in market manipulation
                  </li>
                  <li>Provide accurate information when creating markets</li>
                  <li>Accept the risk of loss associated with trading</li>
                </ul>
                <p className="mt-4">
                  Market creators are responsible for providing accurate
                  resolution criteria and resolving markets in a timely and fair
                  manner. Moodring reserves the right to intervene in market
                  resolution disputes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  6. Trading and Liquidity
                </h2>
                <p>
                  Trading on the Platform involves significant risk. You
                  acknowledge that:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>You may lose all funds used for trading</li>
                  <li>
                    Market prices are determined by supply and demand and may be
                    volatile
                  </li>
                  <li>Liquidity provision involves risk of impermanent loss</li>
                  <li>
                    Smart contract interactions may fail due to network
                    congestion or other factors
                  </li>
                  <li>Blockchain transactions are irreversible</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  7. Fees
                </h2>
                <p>
                  The Platform may charge fees for certain operations,
                  including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Market creation fees</li>
                  <li>Trading fees (a percentage of each trade)</li>
                  <li>Liquidity provision fees</li>
                  <li>Resolution fees</li>
                </ul>
                <p className="mt-4">
                  All fees are displayed before you confirm a transaction. Fees
                  are subject to change, and we will provide notice of material
                  fee changes. You are also responsible for Solana network
                  transaction fees (gas fees) for all on-chain operations.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  8. Prohibited Activities
                </h2>
                <p>You agree not to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Use the Platform for any illegal purpose</li>
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe on intellectual property rights</li>
                  <li>
                    Engage in market manipulation, front-running, or other
                    unfair trading practices
                  </li>
                  <li>
                    Attempt to hack, disrupt, or interfere with the Platform or
                    its smart contracts
                  </li>
                  <li>Use automated systems or bots without authorization</li>
                  <li>
                    Create markets for events that are illegal, harmful, or
                    violate third-party rights
                  </li>
                  <li>Impersonate others or provide false information</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  9. Intellectual Property
                </h2>
                <p>
                  The Platform, including its design, code, logos, and content,
                  is protected by intellectual property laws. You are granted a
                  limited, non-exclusive, non-transferable license to use the
                  Platform for its intended purpose. You may not copy, modify,
                  distribute, or create derivative works without our express
                  written permission.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  10. Disclaimers
                </h2>
                <p>
                  THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
                  WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DISCLAIM ALL
                  WARRANTIES, INCLUDING BUT NOT LIMITED TO:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    Warranties of merchantability, fitness for a particular
                    purpose, or non-infringement
                  </li>
                  <li>
                    Warranties that the Platform will be uninterrupted, secure,
                    or error-free
                  </li>
                  <li>
                    Warranties regarding the accuracy or reliability of market
                    information
                  </li>
                  <li>
                    Warranties that smart contracts will function as intended
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  11. Limitation of Liability
                </h2>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, MOODRING AND ITS
                  AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                  SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
                  LIMITED TO:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Loss of profits, data, or other intangible losses</li>
                  <li>Losses resulting from smart contract bugs or exploits</li>
                  <li>Losses resulting from blockchain network issues</li>
                  <li>Losses resulting from market manipulation or fraud</li>
                  <li>Losses resulting from incorrect market resolutions</li>
                </ul>
                <p className="mt-4">
                  Our total liability for any claims arising from your use of
                  the Platform shall not exceed the amount of fees you paid to
                  us in the 12 months preceding the claim.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  12. Indemnification
                </h2>
                <p>
                  You agree to indemnify, defend, and hold harmless Moodring and
                  its affiliates from any claims, damages, losses, liabilities,
                  and expenses (including legal fees) arising from:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Your use of the Platform</li>
                  <li>Your violation of these Terms</li>
                  <li>Your violation of any applicable laws or regulations</li>
                  <li>Your infringement of any third-party rights</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  13. Dispute Resolution
                </h2>
                <p>
                  Moodring includes a dispute resolution mechanism for market
                  resolution disputes. For other disputes:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    You agree to first contact us to attempt to resolve the
                    dispute informally
                  </li>
                  <li>
                    If informal resolution fails, disputes shall be resolved
                    through binding arbitration
                  </li>
                  <li>
                    Arbitration shall be conducted in accordance with applicable
                    arbitration rules
                  </li>
                  <li>
                    You waive your right to participate in class action lawsuits
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  14. Modifications to Terms
                </h2>
                <p>
                  We reserve the right to modify these Terms at any time.
                  Material changes will be communicated through the Platform or
                  via email. Your continued use of the Platform after changes
                  become effective constitutes acceptance of the modified Terms.
                  If you do not agree to the changes, you must stop using the
                  Platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  15. Termination
                </h2>
                <p>
                  We may suspend or terminate your access to the Platform at any
                  time, with or without cause or notice, for any reason
                  including violation of these Terms. You may stop using the
                  Platform at any time. Upon termination, your right to use the
                  Platform immediately ceases.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  16. Governing Law
                </h2>
                <p>
                  These Terms shall be governed by and construed in accordance
                  with applicable laws, without regard to conflict of law
                  principles. Any legal action or proceeding arising under these
                  Terms shall be brought exclusively in the appropriate courts.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  17. Severability
                </h2>
                <p>
                  If any provision of these Terms is found to be unenforceable
                  or invalid, that provision shall be limited or eliminated to
                  the minimum extent necessary, and the remaining provisions
                  shall remain in full force and effect.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  18. Contact Information
                </h2>
                <p>
                  If you have questions about these Terms, please contact us
                  through the Platform's support channels or at the contact
                  information provided on our website.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
