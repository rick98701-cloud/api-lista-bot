const express = require('express');
const app = express();
app.use(express.json());

// Banco de dados em memória por servidor (Guild)
let eventosPorServidor = {};

// Função auxiliar para gerar a mensagem visual do painel com emojis modernos
const gerarPainelGlobal = (guildId, serverName) => {
    const evento = eventosPorServidor[guildId];
    if (!evento) return "❌ **Nenhuma ação/operação ativa configurada no momento.**";

    const listaMembros = evento.membros;
    const nomeDoServidor = serverName || "Oficiais";
    
    let texto = `⚡ **PAINEL DE OPERAÇÕES OFICIAIS • ${nomeDoServidor.toUpperCase()}**\n\n`;
    texto += `📝 **Informações da Ação Atual:**\n`;
    texto += `> ⚔️ **Tipo De Ação:** \`${evento.tipoAcao}\`\n`;
    texto += `> 👥 **Contingente Máx:** \`${evento.contingenteMax} Operacionais\`\n`;
    texto += `> 🔫 **Armamento Recomendado:** \`${evento.armamento}\`\n`;
    texto += `> 📅 **Data & Horário:** \`${evento.dataHorario}\`\n`;
    texto += `> 🏰 **Apresentação no QG:** \`${evento.horarioQg}\`\n\n`;
    texto += `⚠️ **Aviso:** Garanta os seus equipamentos e clique nos botões abaixo para gerenciar a sua presença.\n`;
    texto += `──────────────────────────────\n`;
    
    const estaLotado = listaMembros.length >= evento.contingenteMax;
    const emojiStatus = estaLotado ? '🔴' : '🟢';
    const textoStatus = estaLotado ? 'LISTA LOTADA' : 'INSCRIÇÕES ABERTAS';
    
    texto += `${emojiStatus} **STATUS DA LISTA:** \`${textoStatus} (${listaMembros.length}/${evento.contingenteMax})\`\n\n`;

    if (listaMembros.length === 0) {
        texto += `*✨ Nenhum membro inscrito. Seja o primeiro a entrar na ação!*`;
    } else {
        listaMembros.forEach((membro, index) => {
            let medalha = '🔹';
            if (index === 0) medalha = '🥇';
            if (index === 1) medalha = '🥈';
            if (index === 2) medalha = '🥉';
            
            texto += `${medalha} \`[Vaga #${String(index + 1).padStart(2, '0')}]\` ❯ <@${membro.id}> (@${membro.username})\n`;
        });
    }
    return texto;
};

// ENDPOINT PRINCIPAL
app.post('/gerenciar-lista', (req, res) => {
    const { guildId, serverName, userId, username, acao, tipoAcao, contingenteMax, armamento, dataHorario, horarioQg, resultado, liderId } = req.body;
    
    if (!guildId) return res.json({ status: "erro", mensagem: "❌ ID do servidor ausente." });

    // 1. CRIAR OU EDITAR O PAINEL DE AÇÃO (Líder envia o formulário)
    if (acao === 'configurar_painel') {
        eventosPorServidor[guildId] = {
            tipoAcao: tipoAcao || "Não informado",
            contingenteMax: parseInt(contingenteMax) || 10,
            armamento: armamento || "Não informado",
            dataHorario: dataHorario || "Não informado",
            horarioQg: horarioQg || "Não informado",
            liderId: liderId || userId, // Salva o ID do líder que criou
            membros: [] 
        };
        return res.json({ status: "sucesso", embed_corpo: gerarPainelGlobal(guildId, serverName) });
    }

    // Bloqueia interações se o painel ainda não foi criado por um líder
    if (!eventosPorServidor[guildId]) {
        return res.json({ status: "erro", mensagem: "❌ Não existe nenhuma operação ativa configurada no momento." });
    }

    const evento = eventosPorServidor[guildId];

    // 2. MEMBRO ENTRAR NA LISTA
    if (acao === 'entrar') {
        const jaEstaNaLista = evento.membros.some(m => m.id === userId);
        if (jaEstaNaLista) return res.json({ status: "erro", mensagem: "⚠️ Você já está inscrito nesta lista de ação!" });
        if (evento.membros.length >= evento.contingenteMax) return res.json({ status: "erro", Extratora: "❌ Esta ação já atingiu o limite máximo de operacionais!" });

        evento.membros.push({ id: userId, username: username });
        return res.json({ status: "sucesso", embed_corpo: gerarPainelGlobal(guildId, serverName) });
    }

    // 3. MEMBRO SAIR DA LISTA
    if (acao === 'sair') {
        const index = evento.membros.findIndex(m => m.id === userId);
        if (index === -1) return res.json({ status: "erro", mensagem: "⚠️ Você não está inscrito nesta lista para poder sair." });

        evento.membros.splice(index, 1);
        return res.json({ status: "sucesso", embed_corpo: gerarPainelGlobal(guildId, serverName) });
    }

    // 4. STAFF ENCERRAR AÇÃO
    if (acao === 'encerrar') {
        const statusResultado = resultado === 'vitoria' ? '🏆 VITÓRIA' : '💀 DERROTA';
        const corResultado = resultado === 'vitoria' ? '🟢' : '🔴';
        const nomeDoServidor = serverName || "Oficiais";
        
        let relatorio = `🏁 **AÇÃO ENCERRADA • RELATÓRIO OFICIAL ${nomeDoServidor.toUpperCase()}**\n\n`;
        relatorio += `> ⚔️ **Operação realizada:** \`${evento.tipoAcao}\`\n`;
        relatorio += `> 🧔 **Responsável pela criação:** <@${evento.liderId}>\n`;
        relatorio += `${corResultado} **Resultado da Missão:** \`${statusResultado}\`\n`;
        relatorio += `> 📅 **Data & Horário:** \`${evento.dataHorario}\`\n`;
        relatorio += `──────────────────────────────\n`;
        relatorio += `🎖️ **ELENCO PARTICIPANTE DESTA OPERAÇÃO:**\n\n`;

        if (evento.membros.length === 0) {
            relatorio += `*Nenhum operacional assinou a lista para esta ação.*`;
        } else {
            evento.membros.forEach((membro, index) => {
                relatorio += `\`[OP #${String(index + 1).padStart(2, '0')}]\` ❯ <@${membro.id}> (@${membro.username})\n`;
            });
        }

        eventosPorServidor[guildId] = null; // Zera a lista do servidor
        return res.json({ status: "encerrado", embed_corpo: relatorio });
    }

    return res.json({ status: "sucesso", embed_corpo: gerarPainelGlobal(guildId, serverName) });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API Global de Listas Rodando na Porta ${PORT}!`));
