const express = require('express');
const app = express();
app.use(express.json());

// Banco de dados em memória por servidor (Guild)
let eventosAntigos = {};
let eventosComReserva = {};

// ==========================================
// LÓGICA DO BOT NOVO (COM SISTEMA DE RESERVA)
// ==========================================
const gerarPainelComReserva = (guildId) => {
    const evento = eventosComReserva[guildId];
    if (!evento) return "❌ **Nenhuma ação/operação ativa configurada no momento.**";

    if (!evento.membros) evento.membros = [];
    if (!evento.reserva) evento.reserva = [];
    
    let texto = `⚡ **PAINEL DE OPERAÇÕES OFICIAIS (NOVO)**\n\n`;
    texto += `📝 **Informações da Ação Atual:**\n`;
    texto += `> ⚔️ **Tipo De Ação:** \`${evento.tipoAcao}\`\n`;
    texto += `> 👥 **Contingente Máx:** \`${evento.contingenteMax} Operacionais\`\n`;
    texto += `> 🔫 **Armamento Recomendado:** \`${evento.armamento}\`\n`;
    texto += `> 📅 **Data & Horário:** \`${evento.dataHorario}\`\n`;
    texto += `> 🏰 **Apresentação no QG:** \`${evento.horarioQg}\`\n\n`;
    texto += `⚠️ **Aviso:** Garanta os seus equipamentos e clique nos botões abaixo.\n`;
    texto += `──────────────────────────────\n`;
    
    const estaLotado = evento.membros.length >= evento.contingenteMax;
    const reservaLotada = evento.reserva.length >= 5;
    
    let textoStatus = 'INSCRIÇÕES ABERTAS';
    let emojiStatus = '🟢';
    
    if (estaLotado && !reservaLotada) {
        textoStatus = `LISTA PRINCIPAL LOTADA • RESERVA ABERTA (${evento.reserva.length}/5)`;
        emojiStatus = '🟡';
    } else if (estaLotado && reservaLotada) {
        textoStatus = `OPERAÇÃO TOTALMENTE LOTADA (${evento.membros.length + evento.reserva.length} TOTAL)`;
        emojiStatus = '🔴';
    }
    
    texto += `${emojiStatus} **STATUS DA LISTA:** \`${textoStatus}\`\n\n`;

    texto += `🎖️ **LISTA PRINCIPAL (${evento.membros.length}/${evento.contingenteMax}):**\n`;
    if (evento.membros.length === 0) {
        texto += `*✨ Nenhum membro inscrito.*`;
    } else {
        evento.membros.forEach((membro, index) => {
            let medalha = '🔹';
            if (index === 0) medalha = '🥇';
            if (index === 1) medalha = '🥈';
            if (index === 2) medalha = '🥉';
            texto += `${medalha} \`[Vaga #${String(index + 1).padStart(2, '0')}]\` ❯ <@${membro.id}>\n`;
        });
    }

    texto += `\n\n⏳ **FILA DE RESERVA VIAVEL (MÁX 5):**\n`;
    if (evento.reserva.length === 0) {
        texto += `*Nenhum operacional na espera por vagas.*`;
    } else {
        evento.reserva.forEach((membro, index) => {
            texto += `\`[RESERVA #${index + 1]\` ❯ <@${membro.id}>\n`;
        });
    }
    return texto;
};

// ROTA NOVA (Para o Bot Novo usar o Sistema de Reserva)
app.post('/gerenciar-lista-reserva', (req, res) => {
    try {
        const { guildId, userId, username, acao, tipoAcao, contingenteMax, armamento, dataHorario, horarioQg, resultado, liderId } = req.body;
        if (!guildId) return res.status(400).send("❌ ID do servidor ausente.");

        if (acao === 'configurar_painel') {
            const maxVagas = parseInt(String(contingenteMax).replace(/[^\d]/g, '')) || 10;
            eventosComReserva[guildId] = {
                tipoAcao: tipoAcao || "Não informado", contingenteMax: maxVagas, armamento: armamento || "Não informado",
                dataHorario: dataHorario || "Não informado", horarioQg: horarioQg || "Não informado", liderId: liderId || userId,
                membros: [], reserva: []
            };
            return res.send(gerarPainelComReserva(guildId));
        }

        if (!eventosComReserva[guildId]) return res.status(400).send("❌ Não existe nenhuma operação ativa configurada.");
        const evento = eventosComReserva[guildId];

        if (acao === 'entrar') {
            if (evento.membros.some(m => m.id === userId) || evento.reserva.some(m => m.id === userId)) {
                return res.status(400).send("⚠️ Você já está inscrito nesta lista de ação!");
            }
            if (evento.membros.length < evento.contingenteMax) {
                evento.membros.push({ id: userId, username: username });
                return res.send(gerarPainelComReserva(guildId));
            } 
            if (evento.reserva.length < 5) {
                evento.reserva.push({ id: userId, username: username });
                return res.send(gerarPainelComReserva(guildId));
            }
            return res.status(400).send("❌ A lista principal e a fila de reserva já estão lotadas!");
        }

        if (acao === 'sair') {
            const indexReserva = evento.reserva.findIndex(m => m.id === userId);
            if (indexReserva !== -1) {
                evento.reserva.splice(indexReserva, 1);
                return res.send(gerarPainelComReserva(guildId));
            }
            const indexPrincipal = evento.membros.findIndex(m => m.id === userId);
            if (indexPrincipal !== -1) {
                evento.membros.splice(indexPrincipal, 1);
                if (evento.reserva.length > 0) {
                    const primeiroDaReserva = evento.reserva.shift();
                    evento.membros.push(primeiroDaReserva);
                }
                return res.send(gerarPainelComReserva(guildId));
            }
            return res.status(400).send("⚠️ Você não está inscrito em nenhuma das listas.");
        }

        if (acao === 'encerrar') {
            const statusResultado = resultado === 'vitoria' ? '🏆 VITÓRIA' : '💀 DERROTA';
            let relatorio = `🏁 **AÇÃO ENCERRADA • RELATÓRIO OFICIAL**\n\n`;
            relatorio += `> ⚔️ **Operação realizada:** \`${evento.tipoAcao}\`\n`;
            relatorio += `> 🟢 **Resultado:** \`${statusResultado}\`\n\n`;
            relatorio += `🎖️ **OPERACIONAIS PARTICIPANTES:**\n`;
            if (evento.membros.length === 0) {
                relatorio += `*Nenhum operacional assinou a lista.*`;
            } else {
                evento.membros.forEach((membro, index) => {
                    relatorio += `\`[OP #${String(index + 1).padStart(2, '0')}]\` ❯ <@${membro.id}>\n`;
                });
            }
            eventosComReserva[guildId] = null;
            return res.send(relatorio);
        }
        return res.send(gerarPainelComReserva(guildId));
    } catch (e) { return res.status(500).send("❌ Erro interno."); }
});

// ==========================================
// ROTA ANTIGA (Mantida intacta para o Bot Antigo)
// ==========================================
const gerarPainelAntigo = (guildId) => {
    const evento = eventosAntigos[guildId];
    if (!evento) return "❌ **Nenhuma ação ativa configurada.**";
    let texto = `⚡ **PAINEL DE OPERAÇÕES OFICIAIS (ANTIGO)**\n\n`;
    texto += `> ⚔️ **Tipo:** \`${evento.tipoAcao}\`\n`;
    texto += `> 👥 **Vagas:** \`${evento.membros.length}/${evento.contingenteMax}\`\n\n`;
    if (evento.membros.length === 0) texto += `*Nenhum membro inscrito.*`;
    else evento.membros.forEach((m, i) => { texto += `🔹 \`[Vaga #${i+1}]\` ❯ <@${m.id}>\n`; });
    return texto;
};

app.post('/gerenciar-lista', (req, res) => {
    try {
        const { guildId, userId, username, acao, tipoAcao, contingenteMax } = req.body;
        if (!guildId) return res.status(400).send("❌ ID do servidor ausente.");

        if (acao === 'configurar_painel') {
            eventosAntigos[guildId] = { tipoAcao: tipoAcao || "Não informado", contingenteMax: parseInt(contingenteMax) || 10, membros: [] };
            return res.send(gerarPainelAntigo(guildId));
        }
        if (!eventosAntigos[guildId]) return res.status(400).send("❌ Sem operação ativa.");
        const evento = eventosAntigos[guildId];

        if (acao === 'entrar') {
            if (evento.membros.some(m => m.id === userId)) return res.status(400).send("⚠️ Já inscrito.");
            if (evento.membros.length >= evento.contingenteMax) return res.status(400).send("❌ Lotado.");
            evento.membros.push({ id: userId, username: username });
            return res.send(gerarPainelAntigo(guildId));
        }
        if (acao === 'sair') {
            const idx = evento.membros.findIndex(m => m.id === userId);
            if (idx === -1) return res.status(400).send("⚠️ Não está na lista.");
            evento.membros.splice(idx, 1);
            return res.send(gerarPainelAntigo(guildId));
        }
        if (acao === 'encerrar') { eventosAntigos[guildId] = null; return res.send("🏁 Ação encerrada."); }
        return res.send(gerarPainelAntigo(guildId));
    } catch (e) { return res.status(500).send("❌ Erro."); }
});

// O Render injeta a porta automaticamente através do process.env.PORT, por isso deixamos dinâmico!
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API unificada rodando com sucesso!`));
