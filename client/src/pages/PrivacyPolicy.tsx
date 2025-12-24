import { GradientDivider } from "@/components/brand";

export const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-graphite-deep">
      <div className="section-container py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Privacy Policy
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
                  1. Introduction
                </h2>
                <p>
                  Moodring ("we", "us", or "our") is committed to protecting
                  your privacy. This Privacy Policy explains how we collect,
                  use, disclose, and safeguard your information when you use our
                  decentralized prediction market platform built on the Solana
                  blockchain.
                </p>
                <p className="mt-4">
                  Please read this Privacy Policy carefully. By using the
                  Platform, you agree to the collection and use of information
                  in accordance with this policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  2. Information We Collect
                </h2>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                  2.1 Information You Provide
                </h3>
                <p>
                  We may collect information that you voluntarily provide,
                  including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    Email address (if you choose to provide it for account
                    verification or notifications)
                  </li>
                  <li>Username or display name</li>
                  <li>Profile information and preferences</li>
                  <li>Market creation data and descriptions</li>
                  <li>Comments and other user-generated content</li>
                  <li>Support requests and communications</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                  2.2 Automatically Collected Information
                </h3>
                <p>
                  We automatically collect certain information when you use the
                  Platform:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    Wallet addresses (public keys) associated with your
                    transactions
                  </li>
                  <li>Transaction history and trading activity</li>
                  <li>IP address and approximate geographic location</li>
                  <li>
                    Browser type, device information, and operating system
                  </li>
                  <li>Usage data, including pages visited and features used</li>
                  <li>
                    Cookies and similar tracking technologies (see our Cookie
                    Policy)
                  </li>
                </ul>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                  2.3 Blockchain Data
                </h3>
                <p>
                  As a decentralized platform, all transactions are recorded on
                  the Solana blockchain, which is publicly accessible. This
                  includes:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>All trading transactions</li>
                  <li>Liquidity provision and removal</li>
                  <li>Market creation and resolution</li>
                  <li>Wallet addresses and transaction amounts</li>
                </ul>
                <p className="mt-4">
                  Blockchain data is immutable and publicly visible. We cannot
                  delete or modify blockchain records.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  3. How We Use Your Information
                </h2>
                <p>
                  We use the information we collect for the following purposes:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    <strong>Service Provision:</strong> To provide, maintain,
                    and improve the Platform
                  </li>
                  <li>
                    <strong>Transaction Processing:</strong> To process and
                    facilitate transactions on the Platform
                  </li>
                  <li>
                    <strong>User Experience:</strong> To personalize your
                    experience and provide relevant content
                  </li>
                  <li>
                    <strong>Communication:</strong> To send you updates,
                    notifications, and respond to inquiries
                  </li>
                  <li>
                    <strong>Security:</strong> To detect, prevent, and address
                    fraud, abuse, and security issues
                  </li>
                  <li>
                    <strong>Analytics:</strong> To analyze usage patterns and
                    improve our services
                  </li>
                  <li>
                    <strong>Compliance:</strong> To comply with legal
                    obligations and enforce our Terms of Service
                  </li>
                  <li>
                    <strong>Market Operations:</strong> To display market data,
                    leaderboards, and platform statistics
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  4. Information Sharing and Disclosure
                </h2>
                <p>
                  We may share your information in the following circumstances:
                </p>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                  4.1 Public Information
                </h3>
                <p>
                  Certain information is publicly available on the blockchain
                  and through the Platform:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    Wallet addresses and transaction history (on blockchain)
                  </li>
                  <li>Market creation and participation data</li>
                  <li>
                    Public profile information (if you choose to make it public)
                  </li>
                  <li>Leaderboard rankings and statistics</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                  4.2 Service Providers
                </h3>
                <p>
                  We may share information with third-party service providers
                  who assist us in operating the Platform, including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Hosting and infrastructure providers</li>
                  <li>Analytics and monitoring services</li>
                  <li>Email and notification services</li>
                  <li>Blockchain data indexing services</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                  4.3 Legal Requirements
                </h3>
                <p>
                  We may disclose information if required by law or in response
                  to valid legal requests, including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Court orders or subpoenas</li>
                  <li>Government investigations</li>
                  <li>Regulatory compliance requirements</li>
                  <li>Protection of rights, property, or safety</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                  4.4 Business Transfers
                </h3>
                <p>
                  In the event of a merger, acquisition, or sale of assets, your
                  information may be transferred to the acquiring entity.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  5. Data Security
                </h2>
                <p>
                  We implement appropriate technical and organizational measures
                  to protect your information:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Secure server infrastructure and access controls</li>
                  <li>Regular security audits and assessments</li>
                  <li>
                    Limited access to personal information on a need-to-know
                    basis
                  </li>
                </ul>
                <p className="mt-4">
                  However, no method of transmission over the internet or
                  electronic storage is 100% secure. While we strive to protect
                  your information, we cannot guarantee absolute security. You
                  are responsible for maintaining the security of your wallet
                  and private keys.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  6. Your Rights and Choices
                </h2>
                <p>
                  Depending on your jurisdiction, you may have certain rights
                  regarding your personal information:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    <strong>Access:</strong> Request access to your personal
                    information
                  </li>
                  <li>
                    <strong>Correction:</strong> Request correction of
                    inaccurate information
                  </li>
                  <li>
                    <strong>Deletion:</strong> Request deletion of your personal
                    information (subject to legal and blockchain constraints)
                  </li>
                  <li>
                    <strong>Portability:</strong> Request transfer of your data
                  </li>
                  <li>
                    <strong>Opt-out:</strong> Opt out of certain data collection
                    or marketing communications
                  </li>
                  <li>
                    <strong>Objection:</strong> Object to processing of your
                    personal information
                  </li>
                </ul>
                <p className="mt-4">
                  Note: Information stored on the blockchain cannot be deleted
                  or modified. To exercise your rights, please contact us using
                  the information provided in Section 10.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  7. Cookies and Tracking Technologies
                </h2>
                <p>
                  We use cookies and similar tracking technologies to collect
                  and store information. For detailed information about our use
                  of cookies, please see our Cookie Policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  8. Third-Party Links and Services
                </h2>
                <p>
                  The Platform may contain links to third-party websites or
                  integrate with third-party services. We are not responsible
                  for the privacy practices of these third parties. We encourage
                  you to review their privacy policies before providing any
                  information.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  9. Children's Privacy
                </h2>
                <p>
                  The Platform is not intended for users under the age of 18. We
                  do not knowingly collect personal information from children.
                  If you believe we have collected information from a child,
                  please contact us immediately.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  10. International Data Transfers
                </h2>
                <p>
                  Your information may be transferred to and processed in
                  countries other than your country of residence. These
                  countries may have different data protection laws. By using
                  the Platform, you consent to the transfer of your information
                  to these countries.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  11. Data Retention
                </h2>
                <p>
                  We retain your information for as long as necessary to provide
                  the Platform and fulfill the purposes outlined in this Privacy
                  Policy, unless a longer retention period is required by law.
                  Blockchain data is retained permanently as part of the
                  immutable blockchain record.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  12. Changes to This Privacy Policy
                </h2>
                <p>
                  We may update this Privacy Policy from time to time. We will
                  notify you of any material changes by posting the new Privacy
                  Policy on this page and updating the "Last updated" date. Your
                  continued use of the Platform after changes become effective
                  constitutes acceptance of the updated Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  13. Contact Us
                </h2>
                <p>
                  If you have questions, concerns, or requests regarding this
                  Privacy Policy or our data practices, please contact us
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
