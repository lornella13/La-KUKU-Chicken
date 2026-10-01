import Navbar from './components/Navbar.jsx'
import Hero from './components/Hero.jsx'
import Story from './components/Story.jsx'
import WhyUs from './components/WhyUs.jsx'
import Products from './components/Products.jsx'
import Locations from './components/Locations.jsx'
import Contact from './components/Contact.jsx'
import OrderCta from './components/OrderCta.jsx'
import Footer from './components/Footer.jsx'
import WhatsAppFloat from './components/WhatsAppFloat.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'

export default function App() {
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