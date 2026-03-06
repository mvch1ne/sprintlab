import { Header } from './components/layout/Header';
import { Dashboard } from './components/layout/Dashboard';

export function App() {
  return (
    <div className="flex flex-col h-full">
      <Header />
      <Dashboard />
    </div>
  );
}

export default App;
