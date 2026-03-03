import { Header } from './components/layout/Header';
import { Page } from './components/layout/Page';

export function App() {
  return (
    <div className="flex flex-col h-full">
      <Header />
      <Page />
    </div>
  );
}

export default App;
