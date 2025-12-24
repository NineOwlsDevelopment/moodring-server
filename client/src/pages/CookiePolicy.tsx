import { GradientDivider } from "@/components/brand";

export const CookiePolicy = () => {
  return (
    <div className="min-h-screen bg-graphite-deep">
      <div className="section-container py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Cookie Policy
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
                  1. What Are Cookies?
                </h2>
                <p>
                  Cookies are small text files that are placed on your device
                  when you visit a website. They are widely used to make
                  websites work more efficiently and provide information to
                  website owners. Cookies allow a website to recognize your
                  device and store some information about your preferences or
                  past actions.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  2. How We Use Cookies
                </h2>
                <p>
                  Moodring uses cookies and similar tracking technologies to
                  enhance your experience on our Platform. We use cookies for
                  the following purposes:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    <strong>Essential Functionality:</strong> To enable core
                    features of the Platform
                  </li>
                  <li>
                    <strong>Authentication:</strong> To maintain your login
                    session and authentication state
                  </li>
                  <li>
                    <strong>Preferences:</strong> To remember your settings and
                    preferences
                  </li>
                  <li>
                    <strong>Analytics:</strong> To understand how users interact
                    with the Platform
                  </li>
                  <li>
                    <strong>Performance:</strong> To optimize Platform
                    performance and loading times
                  </li>
                  <li>
                    <strong>Security:</strong> To detect and prevent fraud and
                    security threats
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  3. Types of Cookies We Use
                </h2>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                  3.1 Essential Cookies
                </h3>
                <p>
                  These cookies are necessary for the Platform to function
                  properly. They enable core functionality such as
                  authentication, security, and network management. These
                  cookies cannot be disabled.
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Session management cookies</li>
                  <li>Authentication tokens</li>
                  <li>Security and fraud prevention cookies</li>
                  <li>Load balancing cookies</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                  3.2 Functional Cookies
                </h3>
                <p>
                  These cookies enhance functionality and personalization. They
                  remember your preferences and choices to provide a more
                  personalized experience.
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Language preferences</li>
                  <li>Theme and display preferences</li>
                  <li>User interface settings</li>
                  <li>Notification preferences</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                  3.3 Analytics Cookies
                </h3>
                <p>
                  These cookies help us understand how visitors interact with
                  the Platform by collecting and reporting information
                  anonymously.
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Page views and navigation patterns</li>
                  <li>Feature usage statistics</li>
                  <li>Performance metrics</li>
                  <li>Error tracking</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                  3.4 Third-Party Cookies
                </h3>
                <p>
                  We may use third-party services that set their own cookies.
                  These services help us provide and improve the Platform.
                  Third-party cookies are subject to the privacy policies of
                  those third parties.
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Analytics providers (e.g., Google Analytics)</li>
                  <li>Error tracking services</li>
                  <li>Performance monitoring tools</li>
                  <li>Content delivery networks</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  4. Cookie Duration
                </h2>
                <p>We use both session cookies and persistent cookies:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    <strong>Session Cookies:</strong> Temporary cookies that are
                    deleted when you close your browser. These are used to
                    maintain your session while using the Platform.
                  </li>
                  <li>
                    <strong>Persistent Cookies:</strong> Cookies that remain on
                    your device for a set period or until you delete them. These
                    remember your preferences and settings across sessions.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  5. Managing Cookies
                </h2>
                <p>
                  You have control over cookies. Most web browsers allow you to
                  manage cookie preferences. You can:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>View and delete cookies stored on your device</li>
                  <li>Block cookies from specific websites</li>
                  <li>Block all cookies</li>
                  <li>
                    Set your browser to notify you when cookies are being set
                  </li>
                </ul>
                <p className="mt-4">
                  However, please note that disabling certain cookies may impact
                  the functionality of the Platform. Essential cookies are
                  required for the Platform to work properly.
                </p>
                <p className="mt-4">
                  Instructions for managing cookies in popular browsers:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    <strong>Chrome:</strong> Settings → Privacy and security →
                    Cookies and other site data
                  </li>
                  <li>
                    <strong>Firefox:</strong> Options → Privacy & Security →
                    Cookies and Site Data
                  </li>
                  <li>
                    <strong>Safari:</strong> Preferences → Privacy → Cookies and
                    website data
                  </li>
                  <li>
                    <strong>Edge:</strong> Settings → Cookies and site
                    permissions → Cookies and site data
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  6. Do Not Track Signals
                </h2>
                <p>
                  Some browsers include a "Do Not Track" (DNT) feature that
                  signals to websites you visit that you do not want to have
                  your online activity tracked. Currently, there is no standard
                  for how DNT signals should be interpreted. We do not currently
                  respond to DNT browser signals or mechanisms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  7. Local Storage and Similar Technologies
                </h2>
                <p>
                  In addition to cookies, we may use other similar technologies
                  such as:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    <strong>Local Storage:</strong> To store larger amounts of
                    data on your device
                  </li>
                  <li>
                    <strong>Session Storage:</strong> To store temporary data
                    for your current session
                  </li>
                  <li>
                    <strong>Web Beacons:</strong> Small images embedded in web
                    pages or emails
                  </li>
                  <li>
                    <strong>Pixel Tags:</strong> Similar to web beacons, used to
                    track user activity
                  </li>
                </ul>
                <p className="mt-4">
                  These technologies serve similar purposes to cookies and are
                  subject to the same privacy considerations.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  8. Updates to This Cookie Policy
                </h2>
                <p>
                  We may update this Cookie Policy from time to time to reflect
                  changes in our practices or for other operational, legal, or
                  regulatory reasons. We will notify you of any material changes
                  by posting the updated policy on this page and updating the
                  "Last updated" date.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  9. Contact Us
                </h2>
                <p>
                  If you have questions about our use of cookies or this Cookie
                  Policy, please contact us through the Platform's support
                  channels or at the contact information provided on our
                  website.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
