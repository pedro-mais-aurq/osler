import { loadEnv } from 'vite'
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }
if (env.VITE_DATA_MODE === 'local') throw new Error('Produção não permite contas de demonstração.')
if (!env.VITE_SUPABASE_URL || !(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)) throw new Error('Configure a URL e a chave pública do projeto Supabase da Osler antes de publicar.')
if (!/^https:\/\//.test(env.VITE_SUPABASE_URL)) throw new Error('A conexão de produção deve usar HTTPS.')
console.log('Configuração de produção presente. Google OAuth e migrations devem estar habilitados no projeto.')
