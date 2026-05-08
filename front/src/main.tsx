import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import App from './App';
import './config/amplify';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={esES} theme={{ token: { colorPrimary: '#1677ff' } }}>
    <App />
  </ConfigProvider>
);
