import { Dashboard } from '../components/Dashboard';

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Publications Using <span className="gradient-text">NBDC</span> Data
      </h1>
      <Dashboard />
    </div>
  );
}
