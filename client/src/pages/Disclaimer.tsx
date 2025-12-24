import { GradientDivider } from "@/components/brand";

export const Disclaimer = () => {
  return (
    <div className="min-h-screen bg-graphite-deep">
      <div className="section-container py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Disclaimer
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
                  1. General Disclaimer
                </h2>
                <p>
                  The information provided on Moodring ("the Platform") is for
                  general informational purposes only. The Platform is a
                  decentralized prediction market platform built on the Solana
                  blockchain. By using the Platform, you acknowledge and agree
                  to the following disclaimers.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  2. Not Trading Advice
                </h2>
                <p>
                  <strong>
                    THE PLATFORM DOES NOT PROVIDE TRADING, LEGAL, OR TAX ADVICE.
                  </strong>{" "}
                  All information, content, and materials available on the
                  Platform are for informational purposes only and should not be
                  construed as:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Trading advice</li>
                  <li>Recommendations to buy, sell, or hold any shares</li>
                  <li>Legal or tax advice</li>
                  <li>Professional advice of any kind</li>
                </ul>
                <p className="mt-4">
                  You should consult with qualified professionals before making
                  any trading, legal, or tax decisions. Past performance does
                  not guarantee future results.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  3. High Risk Warning
                </h2>
                <p>
                  <strong>
                    TRADING ON PREDICTION MARKETS INVOLVES SUBSTANTIAL RISK OF
                    LOSS.
                  </strong>{" "}
                  You may lose some or all of the funds you use for trading.
                  Risks include but are not limited to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    <strong>Total Loss:</strong> You may lose all funds used for
                    trading
                  </li>
                  <li>
                    <strong>Market Volatility:</strong> Market prices can be
                    highly volatile and unpredictable
                  </li>
                  <li>
                    <strong>Liquidity Risk:</strong> Markets may have limited
                    liquidity, making it difficult to enter or exit positions
                  </li>
                  <li>
                    <strong>Smart Contract Risk:</strong> Smart contracts may
                    contain bugs or be exploited, resulting in loss of funds
                  </li>
                  <li>
                    <strong>Blockchain Risk:</strong> Network congestion, forks,
                    or other blockchain issues may affect transactions
                  </li>
                  <li>
                    <strong>Resolution Risk:</strong> Market resolutions may be
                    disputed or incorrect
                  </li>
                  <li>
                    <strong>Regulatory Risk:</strong> Changes in laws or
                    regulations may affect the Platform or your ability to use
                    it
                  </li>
                  <li>
                    <strong>Technology Risk:</strong> Technical failures, hacks,
                    or security breaches may result in loss of funds
                  </li>
                </ul>
                <p className="mt-4">
                  <strong>
                    Only trade with funds you can afford to lose completely.
                  </strong>
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  4. No Guarantees
                </h2>
                <p>
                  We make no guarantees, representations, or warranties
                  regarding:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    The accuracy, completeness, or reliability of any
                    information on the Platform
                  </li>
                  <li>The performance or success of any trades or positions</li>
                  <li>
                    The availability, security, or uninterrupted operation of
                    the Platform
                  </li>
                  <li>The correctness of market resolutions</li>
                  <li>The value or stability of any tokens or funds</li>
                  <li>
                    The absence of errors, bugs, or vulnerabilities in smart
                    contracts
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  5. Market Information
                </h2>
                <p>
                  Market data, prices, statistics, and other information
                  displayed on the Platform are provided for informational
                  purposes only. This information:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>May not be accurate, complete, or up-to-date</li>
                  <li>May contain errors or omissions</li>
                  <li>
                    Should not be relied upon as the sole basis for trading
                    decisions
                  </li>
                  <li>Is subject to change without notice</li>
                </ul>
                <p className="mt-4">
                  You should verify all information independently before making
                  any trading decisions.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  6. Smart Contract Risks
                </h2>
                <p>
                  The Platform operates using smart contracts on the Solana
                  blockchain. Smart contracts are subject to various risks:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    Bugs, errors, or vulnerabilities that may be exploited
                  </li>
                  <li>Immutable nature means bugs cannot be easily fixed</li>
                  <li>
                    Potential for loss of funds due to smart contract failures
                  </li>
                  <li>
                    Dependence on blockchain network stability and security
                  </li>
                  <li>Risk of front-running or other manipulation</li>
                </ul>
                <p className="mt-4">
                  Smart contracts are deployed "as-is" and we cannot guarantee
                  their security or functionality. You use smart contracts at
                  your own risk.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  7. Regulatory Compliance
                </h2>
                <p>
                  Prediction markets may be subject to various laws and
                  regulations in different jurisdictions. These laws may:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    Prohibit or restrict prediction markets in your jurisdiction
                  </li>
                  <li>Require licensing or registration</li>
                  <li>Impose taxes or reporting requirements</li>
                  <li>
                    Change over time, affecting the legality of the Platform
                  </li>
                </ul>
                <p className="mt-4">
                  You are solely responsible for ensuring your use of the
                  Platform complies with all applicable laws and regulations in
                  your jurisdiction. We do not provide legal advice regarding
                  regulatory compliance.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  8. Third-Party Content
                </h2>
                <p>
                  The Platform may contain content, links, or references to
                  third-party websites, services, or information. We do not:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    Endorse or assume responsibility for third-party content
                  </li>
                  <li>
                    Guarantee the accuracy or reliability of third-party
                    information
                  </li>
                  <li>Control or monitor third-party websites or services</li>
                </ul>
                <p className="mt-4">
                  Your interactions with third parties are solely between you
                  and the third party. We are not responsible for any loss or
                  damage resulting from such interactions.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  9. No Endorsement
                </h2>
                <p>
                  The presence of markets, users, or content on the Platform
                  does not constitute an endorsement by Moodring. We do not:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Endorse any particular market, outcome, or prediction</li>
                  <li>
                    Guarantee the accuracy of market information or resolutions
                  </li>
                  <li>
                    Vouch for the credibility of market creators or participants
                  </li>
                  <li>Provide any assurance regarding market outcomes</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  10. Limitation of Liability
                </h2>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, MOODRING AND ITS
                  AFFILIATES SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT,
                  INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
                  INCLUDING BUT NOT LIMITED TO:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Loss of funds or tokens</li>
                  <li>Loss of profits or trading opportunities</li>
                  <li>Loss of data or information</li>
                  <li>Business interruption</li>
                  <li>Errors in market resolutions</li>
                  <li>Smart contract failures or exploits</li>
                  <li>Blockchain network issues</li>
                </ul>
                <p className="mt-4">
                  This limitation applies regardless of the theory of liability,
                  whether in contract, tort, strict liability, or otherwise,
                  even if we have been advised of the possibility of such
                  damages.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  11. No Warranty
                </h2>
                <p>
                  THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
                  WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING
                  BUT NOT LIMITED TO:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Warranties of merchantability</li>
                  <li>Warranties of fitness for a particular purpose</li>
                  <li>Warranties of non-infringement</li>
                  <li>
                    Warranties regarding accuracy, reliability, or completeness
                  </li>
                  <li>Warranties of uninterrupted or error-free operation</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  12. Your Responsibility
                </h2>
                <p>You are solely responsible for:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Your use of the Platform and all trading decisions</li>
                  <li>
                    Understanding the risks involved in prediction markets
                  </li>
                  <li>
                    Ensuring compliance with applicable laws and regulations
                  </li>
                  <li>Securing your wallet and private keys</li>
                  <li>
                    Verifying all information before making trading decisions
                  </li>
                  <li>Seeking professional advice when appropriate</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  13. Changes to Platform
                </h2>
                <p>
                  We reserve the right to modify, suspend, or discontinue the
                  Platform or any part thereof at any time, with or without
                  notice. We are not liable for any loss or damage resulting
                  from such changes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  14. Acknowledgment
                </h2>
                <p>By using the Platform, you acknowledge that:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>You have read and understood this Disclaimer</li>
                  <li>
                    You understand the risks involved in using prediction
                    markets
                  </li>
                  <li>You are using the Platform at your own risk</li>
                  <li>You will not hold Moodring liable for any losses</li>
                  <li>You have the ability to handle potential losses</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  15. Contact Us
                </h2>
                <p>
                  If you have questions about this Disclaimer, please contact us
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
