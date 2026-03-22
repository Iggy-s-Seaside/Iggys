import { useState, type FormEvent } from 'react';
import emailjs from '@emailjs/browser';
import { MapPin, Clock, Sparkles, Mail, Phone } from 'lucide-react';
import { images } from '../data/images';

const infoRows = [
  { icon: MapPin, text: '200 S Franklin St, Seaside, OR 97138', href: 'https://maps.google.com/?q=200+S+Franklin+St,+Seaside,+OR+97138' },
  { icon: Clock, text: '7 Days / 12pm – 12am' },
  { icon: Sparkles, text: 'Happy Hour: Daily 3pm – 5pm' },
  { icon: Phone, text: '(503) 738-0672', href: 'tel:+15037380672' },
  { icon: Mail, text: 'iggysbarevents@gmail.com', href: 'mailto:iggysbarevents@gmail.com' },
];

const subjectOptions = [
  'General Inquiry',
  'Private Event',
  'Book a Private Event',
  'Feedback',
  'Other',
];

const inputClasses =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-text-dim focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await emailjs.send(
        import.meta.env.VITE_EMAIL_SERVICE_ID,
        import.meta.env.VITE_EMAIL_TEMPLATE_ID,
        formData,
        import.meta.env.VITE_EMAIL_PUBLIC_KEY
      );
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          subject: 'General Inquiry',
          message: '',
        });
      }, 3000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const mapsUrl = `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_API_KEY}&q=200+S+Franklin+St,+Seaside,+OR+97138`;

  return (
    <>
      {/* Hero with bar top photo */}
      <section className="relative py-24 lg:py-32 pt-32 text-center overflow-hidden">
        <img
          src={images.barTop}
          alt="Iggy's bar top"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/75" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="uppercase tracking-widest text-xs font-bold text-primary mb-4">
            Let's Connect
          </p>
          <div className="w-12 h-0.5 bg-gradient-to-r from-primary to-accent mx-auto mb-6" />
          <h1 className="font-heading text-4xl lg:text-5xl font-bold text-white">
            Contact Us
          </h1>
          <p className="text-text-muted text-lg max-w-2xl mx-auto mt-4">
            Questions, events, or just saying hi
          </p>
        </div>
      </section>

      <section className="section-padding">
        <div className="section-container">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Left column — Info */}
            <div>
              <div className="glass-card p-6 mb-8">
                <h2 className="font-heading text-2xl font-bold text-white mb-6">
                  Visit Iggy's
                </h2>

                {infoRows.map(({ icon: Icon, text, href }) => (
                  <div
                    key={text}
                    className="flex items-start gap-4 py-4 border-b border-white/5 last:border-b-0"
                  >
                    <Icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    {href ? (
                      <a href={href} className="text-text-muted hover:text-primary transition-colors">
                        {text}
                      </a>
                    ) : (
                      <span className="text-text-muted">{text}</span>
                    )}
                  </div>
                ))}

                <iframe
                  title="Iggy's location on Google Maps"
                  src={mapsUrl}
                  className="w-full h-48 md:h-64 rounded-xl border-0 mt-6"
                  loading="lazy"
                  allowFullScreen
                />
              </div>

            </div>

            {/* Right column — Form */}
            <div>
              <div className="glass-card p-6">
                <h2 className="font-heading text-2xl font-bold text-white mb-6">
                  Send a Message
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name + Email row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-text-muted mb-1 block">
                        Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Your name"
                        required
                        className={inputClasses}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-muted mb-1 block">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        required
                        className={inputClasses}
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="(optional)"
                      className={inputClasses}
                    />
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">
                      Subject
                    </label>
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className={inputClasses}
                    >
                      {subjectOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">
                      Message
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="How can we help?"
                      rows={5}
                      required
                      className={inputClasses}
                    />
                  </div>

                  {/* Error message */}
                  {error && (
                    <p className="text-amber-400 text-sm">{error}</p>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || success}
                    className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {success
                      ? 'Message Sent!'
                      : loading
                        ? 'Sending...'
                        : 'Send Message'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
