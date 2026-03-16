import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="font-heading text-6xl font-bold gradient-text mb-4">
        404
      </h1>
      <p className="text-text-muted text-lg mb-8">
        Page Not Found
      </p>
      <Link to="/" className="btn-primary">
        Go Home
      </Link>
    </section>
  );
}
