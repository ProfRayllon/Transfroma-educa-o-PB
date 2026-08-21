import axios from 'axios'

/**
 * Cliente HTTP das telas publicas.
 *
 * Sem interceptors de propósito: nao manda token e nao reage a 401. As outras
 * duas instancias (equipe e cursista) limpam a sessao quando levam 401, e a home
 * e aberta a visitante -- uma chamada publica que falhasse nao pode derrubar a
 * sessao de quem por acaso esteja logado em outra aba.
 */
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

export default publicApi
