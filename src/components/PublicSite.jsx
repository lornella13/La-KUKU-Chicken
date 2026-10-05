import Navbar from './Navbar.jsx'
import Hero from './Hero.jsx'
import Story from './Story.jsx'
import WhyUs from './WhyUs.jsx'
import Products from './Products.jsx'
import Locations from './Locations.jsx'
import Contact from './Contact.jsx'
import OrderCta from './OrderCta.jsx'
import Footer from './Footer.jsx'
import WhatsAppFloat from './WhatsAppFloat.jsx'
import InstallPrompt from './InstallPrompt.jsx'
import OfflineBanner from './OfflineBanner.jsx'

/**
 * The public website.
 *
 * This is the original App.jsx component tree, unchanged and in the same order.
 * It was moved out of App.jsx only so App.jsx could become the router root; no
 * component, design or section was removed or reordered.
 */
export default function PublicSite() {
  return (
    <>
      <OfflineBanner />
      <a className="skip-link" href="#top">Skip to content</a>
      <Navbar />
      <main id="top">
        <Hero />
        <Story />
        <WhyUs />
        <Products />
        <Locations />
        <Contact />
        <OrderCta />
      </main>
      <Footer />
      <WhatsAppFloat />
      <InstallPrompt />
    </>
  )
}