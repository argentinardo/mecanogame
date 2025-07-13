import { Game } from './components/Game';
import MobileWarning from './components/MobileWarning';
import './styles/global.css';

function App() {
  return (
    <>
      <MobileWarning />
    <Game />
    </>
  );
}

export default App;
