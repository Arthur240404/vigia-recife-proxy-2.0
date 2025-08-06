# V.I.G.I.A. Recife - Servidor Proxy v2.0

Servidor proxy expandido para múltiplas APIs da Prefeitura do Recife.

## Funcionalidades

- ✅ Cache inteligente (TTL 15 minutos)
- ✅ Retry automático em falhas
- ✅ Rate limiting e segurança
- ✅ Múltiplos endpoints especializados
- ✅ Limpeza automática de cache

## Endpoints Disponíveis

### Dados Gerais
- `GET /health` - Status do servidor
- `GET /api/datasets` - Lista todos os datasets
- `GET /api/dataset/:id` - Detalhes de um dataset
- `GET /api/search?q=termo` - Busca geral

### Dados Específicos
- `GET /api/saude/medicamentos` - Estoque de medicamentos
- `GET /api/mobilidade/acidentes` - Acidentes de trânsito
- `GET /api/financeiro/receitas` - Receitas municipais
- `GET /api/financeiro/despesas` - Despesas municipais
- `GET /api/empresas/cadastro` - Empresas cadastradas
- `GET /api/156/demandas` - Demandas dos cidadãos

## Deploy no Railway

1. Conectar repositório GitHub
2. Configurar variáveis de ambiente
3. Deploy automático

## Desenvolvimento Local

```bash
npm install
npm start
```

## Monitoramento

- Cache stats disponível em `/health`
- Logs detalhados de todas as operações
- Limpeza automática a cada 4 horas
