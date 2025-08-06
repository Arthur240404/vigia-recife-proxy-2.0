const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const cron = require('node-cron');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Cache com TTL de 15 minutos
const cache = new NodeCache({ stdTTL: 900 });

// Middleware
app.use(helmet());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// URLs base das APIs
const API_BASES = {
    ckan: 'http://dados.recife.pe.gov.br/api/3',
    transparencia: 'https://portaldatransparencia.recife.pe.gov.br/api',
    receitas: 'https://portaldatransparencia.recife.pe.gov.br/dados/api/receitas',
    despesas: 'https://portaldatransparencia.recife.pe.gov.br/dados/api/despesas'
};

// Função para fazer requisições com retry
async function fetchWithRetry(url, retries = 3, timeout = 10000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
                timeout: timeout,
                headers: {
                    'User-Agent': 'VIGIA-Recife/2.0',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            return response.data;
        } catch (error) {
            console.log(`Tentativa ${i + 1} falhou para ${url}: ${error.message}`);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Rota de saúde
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        cache_stats: cache.getStats()
    });
});

// Rota para listar todos os datasets disponíveis
app.get('/api/datasets', async (req, res) => {
    try {
        const cacheKey = 'datasets_list';
        let data = cache.get(cacheKey);

        if (!data) {
            data = await fetchWithRetry(`${API_BASES.ckan}/action/package_list`);
            cache.set(cacheKey, data, 3600); // Cache por 1 hora
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar datasets:', error.message);
        res.status(500).json({ error: 'Erro ao acessar API de datasets', details: error.message });
    }
});

// Rota para obter detalhes de um dataset específico
app.get('/api/dataset/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const cacheKey = `dataset_${id}`;
        let data = cache.get(cacheKey);

        if (!data) {
            data = await fetchWithRetry(`${API_BASES.ckan}/action/package_show?id=${id}`);
            cache.set(cacheKey, data, 1800); // Cache por 30 min
        }

        res.json(data);
    } catch (error) {
        console.error(`Erro ao buscar dataset ${req.params.id}:`, error.message);
        res.status(500).json({ error: `Erro ao acessar dataset ${req.params.id}`, details: error.message });
    }
});

// Rota para pesquisar dados em um resource específico
app.get('/api/datastore/:resource_id', async (req, res) => {
    try {
        const { resource_id } = req.params;
        const { limit = 100, offset = 0, filters } = req.query;

        let url = `${API_BASES.ckan}/action/datastore_search?resource_id=${resource_id}&limit=${limit}&offset=${offset}`;

        if (filters) {
            url += `&filters=${encodeURIComponent(filters)}`;
        }

        const cacheKey = `datastore_${resource_id}_${limit}_${offset}_${filters || 'nofilter'}`;
        let data = cache.get(cacheKey);

        if (!data) {
            data = await fetchWithRetry(url);
            cache.set(cacheKey, data, 900); // Cache por 15 min
        }

        res.json(data);
    } catch (error) {
        console.error(`Erro ao buscar dados do resource ${req.params.resource_id}:`, error.message);
        res.status(500).json({ error: `Erro ao acessar dados do resource ${req.params.resource_id}`, details: error.message });
    }
});

// Rotas específicas para diferentes tipos de dados

// 1. SAÚDE - Estoque de medicamentos
app.get('/api/saude/medicamentos', async (req, res) => {
    try {
        const cacheKey = 'saude_medicamentos';
        let data = cache.get(cacheKey);

        if (!data) {
            // Resource ID do conjunto de medicamentos
            data = await fetchWithRetry(`${API_BASES.ckan}/action/datastore_search?resource_id=49657ff7-9860-4b3b-9840-c4239c34f3d2&limit=1000`);
            cache.set(cacheKey, data, 900);
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar medicamentos:', error.message);
        res.status(500).json({ error: 'Erro ao acessar dados de medicamentos', details: error.message });
    }
});

// 2. MOBILIDADE - Dados da CTTU
app.get('/api/mobilidade/acidentes', async (req, res) => {
    try {
        const cacheKey = 'cttu_acidentes';
        let data = cache.get(cacheKey);

        if (!data) {
            data = await fetchWithRetry(`${API_BASES.ckan}/action/datastore_search?resource_id=b8094cbb-c904-4325-b375-8276bc1a6d0b&limit=1000`);
            cache.set(cacheKey, data, 900);
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar acidentes:', error.message);
        res.status(500).json({ error: 'Erro ao acessar dados de acidentes', details: error.message });
    }
});

// 3. TRANSPARÊNCIA - Receitas (já funcionando)
app.get('/api/financeiro/receitas', async (req, res) => {
    try {
        const { ano = '2025' } = req.query;
        const cacheKey = `receitas_${ano}`;
        let data = cache.get(cacheKey);

        if (!data) {
            data = await fetchWithRetry(`${API_BASES.receitas}/${ano}`);
            cache.set(cacheKey, data, 1800);
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar receitas:', error.message);
        res.status(500).json({ error: 'Erro ao acessar receitas', details: error.message });
    }
});

// 4. TRANSPARÊNCIA - Despesas (já funcionando)
app.get('/api/financeiro/despesas', async (req, res) => {
    try {
        const { ano = '2025' } = req.query;
        const cacheKey = `despesas_${ano}`;
        let data = cache.get(cacheKey);

        if (!data) {
            data = await fetchWithRetry(`${API_BASES.despesas}/${ano}`);
            cache.set(cacheKey, data, 1800);
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar despesas:', error.message);
        res.status(500).json({ error: 'Erro ao acessar despesas', details: error.message });
    }
});

// 5. EMPRESAS - Cadastro de empresas
app.get('/api/empresas/cadastro', async (req, res) => {
    try {
        const cacheKey = 'empresas_cadastro';
        let data = cache.get(cacheKey);

        if (!data) {
            data = await fetchWithRetry(`${API_BASES.ckan}/action/datastore_search?resource_id=61ca6a8b-1648-44a5-87db-431777b33144&limit=5000`);
            cache.set(cacheKey, data, 3600);
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar empresas:', error.message);
        res.status(500).json({ error: 'Erro ao acessar cadastro de empresas', details: error.message });
    }
});

// 6. CENTRAL 156 - Demandas dos cidadãos
app.get('/api/156/demandas', async (req, res) => {
    try {
        const cacheKey = '156_demandas';
        let data = cache.get(cacheKey);

        if (!data) {
            data = await fetchWithRetry(`${API_BASES.ckan}/action/datastore_search?resource_id=a87570a9-94af-4610-b729-a59ff21a574d&limit=2000`);
            cache.set(cacheKey, data, 900); // Atualização mais frequente para dados vivos
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar demandas 156:', error.message);
        res.status(500).json({ error: 'Erro ao acessar demandas do 156', details: error.message });
    }
});

// Rota para busca genérica
app.get('/api/search', async (req, res) => {
    try {
        const { q, rows = 20 } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Parâmetro de busca (q) é obrigatório' });
        }

        const cacheKey = `search_${q}_${rows}`;
        let data = cache.get(cacheKey);

        if (!data) {
            data = await fetchWithRetry(`${API_BASES.ckan}/action/package_search?q=${encodeURIComponent(q)}&rows=${rows}`);
            cache.set(cacheKey, data, 1800);
        }

        res.json(data);
    } catch (error) {
        console.error('Erro na busca:', error.message);
        res.status(500).json({ error: 'Erro ao realizar busca', details: error.message });
    }
});

// Cron job para limpar cache periodicamente
cron.schedule('0 */4 * * *', () => {
    console.log('Limpando cache...');
    cache.flushAll();
});

// Middleware de erro global
app.use((error, req, res, next) => {
    console.error('Erro não capturado:', error);
    res.status(500).json({ 
        error: 'Erro interno do servidor', 
        timestamp: new Date().toISOString() 
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint não encontrado',
        availableEndpoints: [
            '/health',
            '/api/datasets',
            '/api/dataset/:id',
            '/api/datastore/:resource_id',
            '/api/saude/medicamentos',
            '/api/mobilidade/acidentes',
            '/api/financeiro/receitas',
            '/api/financeiro/despesas',
            '/api/empresas/cadastro',
            '/api/156/demandas',
            '/api/search'
        ]
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor VIGIA Proxy v2.0 rodando na porta ${port}`);
    console.log(`📊 Cache configurado com TTL de 15 minutos`);
    console.log(`🔄 Cron job de limpeza a cada 4 horas`);
});