const express = require('express');
const app = express();
app.use(express.json());
const fs = require('fs');

let eventosComReserva = {};
let ultimosRelatorios = {}; 

const carregarDadosDoDisco = () => {
    if (fs.existsSync('eventos.json')) {
        try {
            eventosComReserva = JSON.parse(fs.readFileSync('eventos.json', 'utf8'));
            console.log("💾 OPERAÇÕES ATIVAS ATUALIZADAS DO DISCO!");
        } catch (err) { console.log("Erro ao ler eventos.json", err); }
    }
};

const salvarDadosNoDisco = () => {
    try {
        fs.writeFileSync('eventos.json', JSON.stringify(eventosComReserva, null, 2), 'utf8');
    } catch (err) { console.log("Erro ao salvar no disco", err); }
};

const obterDataHoraBrasilia = () => {
    return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

const gerarPainelComReserva = (guildId) => {
    const evento = eventosComReserva[guildId];
    if (!evento) return "❌ **Nenhuma ação/operação ativa configurada no momento.**";

    if (!evento.membros) evento.membros = [];
    if (!evento.reserva) evento.reserva = [];
    
    let texto = "⚡ **PAINEL DE OPERAÇÕES OFICIAIS (NOVO)**\n\n";
    texto += "📝 **Informações da Ação Atual:**\n";
    texto += "> ⚔️ **Tipo De Ação:** `" + evento.tipoAcao + "`\n";
    texto += "> 👥 **Contingente Máx:** `" + evento.contingenteMax + " Membros`\n";
    texto += "> 🔫 **Armamento Recomendado:** `" + evento.armamento + "`\n";
    texto += "> 📅 **Data & Horário:** `" + evento.dataHorario + "`\n";
    texto += "> 🏰 **Apresentação no QG:** `" + evento.horarioQg + "`\n\n";
    texto += "⚠️ **Aviso:** Garanta os seus equipamentos and clique nos botões abaixo.\n";
    texto += "──────────────────────────────\n";
    
    const estaLotado = evento.membros.length >= evento.contingenteMax;
    const reservaLotada = evento.reserva.length >= 5;
    
    let textoStatus = 'INSCRIÇÕES ABERTAS';
    let emojiStatus = '🟢';
    
    if (estaLotado && !reservaLotada) {
        textoStatus = "LISTA PRINCIPAL LOTADA • RESERVA ABERTA (" + evento.reserva.length + "/5)";
        emojiStatus = '🟡';
    } else if (estaLotado && reservaLotada) {
        textoStatus = "OPERAÇÃO TOTALMENTE LOTADA (" + (evento.membros.length + evento.reserva.length) + " TOTAL)";
        emojiStatus = '🔴';
    }
    
    texto += emojiStatus + " **STATUS DA LISTA:** `" + textoStatus + "`\n\n";
    texto += "🎖️ **LISTA PRINCIPAL (" + evento.membros.length + "/" + evento.contingenteMax + "):**\n";
    
    if (evento.membros.length === 0) {
        texto += "*Nenhum membro na lista atual.*";
    } else {
        evento.membros.forEach((membro, index) => {
            texto += "`" + (index + 1) + " -` <@" + membro.id + ">\n";
        });
    }

    texto += "\n\n⏳ **FILA DE RESERVA VIAVEL (MÁX 5):**\n";
    if (evento.reserva.length === 0) {
        texto += "*Nenhum membro na espera por vagas.*";
    } else {
        evento.reserva.forEach((membro, index) => {
            texto += "`" + (index + 1) + " -` <@" + membro.id + ">\n";
        });
    }
    return texto;
};

carregarDadosDoDisco();

app.post('/gerenciar-lista-reserva', (req, res) => {
    try {
        console.log("📥 DADOS RECEBIDOS NA REQUISIÇÃO:", req.body);
        carregarDadosDoDisco();

        let { guildId, userId, username, acao, tipoAcao, contingenteMax, armamento, dataHorario, horarioQg, resultado, valorGanho } = req.body;
        if (!guildId) return res.status(400).send("❌ ID do servidor ausente.");

        let idAlvo = userId;
        if (req.body.values && req.body.values.length > 0 && req.body.values !== guildId) {
            idAlvo = req.body.values;
        } else if (req.body.selected_option && req.body.selected_option !== guildId) {
            idAlvo = req.body.selected_option;
        }

        if (acao === 'configurar_painel') {
            const maxVagas = parseInt(String(contingenteMax).replace(/[^\d]/g, '')) || 10;
            eventosComReserva[guildId] = {
                tipoAcao: tipoAcao || "Não informado", 
                contingenteMax: maxVagas, 
                armamento: armamento || "Não informado",
                dataHorario: dataHorario || "Não informado", 
                horarioQg: horarioQg || "Não informado", 
                membros: [], 
                reserva: []
            };
            salvarDadosNoDisco();
            return res.send(gerarPainelComReserva(guildId));
        }

        if (acao === 'encerrar' && !eventosComReserva[guildId] && ultimosRelatorios[guildId]) {
            return res.json(ultimosRelatorios[guildId]);
        }

        if (!eventosComReserva[guildId]) {
            if (acao === 'encerrar') {
                return res.status(400).send("❌ Erro ao buscar os dados da lista ativa para o relatório.");
            }
            const maxVagasFallback = parseInt(String(contingenteMax).replace(/[^\d]/g, '')) || 7;
            eventosComReserva[guildId] = {
                tipoAcao: tipoAcao || "Operação em Andamento", 
                contingenteMax: maxVagasFallback, 
                armamento: armamento || "Padrão",
                dataHorario: dataHorario || obterDataHoraBrasilia(), 
                horarioQg: "No QG", 
                membros: [], 
                reserva: []
            };
        }
        
        const evento = eventosComReserva[guildId];

        // --- AÇÃO: ADICIONAR MANUAL ---
        if (acao === 'entrar' || acao === 'adicionar_manual') {
            const idParaAdicionar = (acao === 'adicionar_manual') ? idAlvo : userId;

            if (!idParaAdicionar || idParaAdicionar === guildId) {
                return res.status(400).send("❌ ID do usuário inválido ou ausente.");
            }

            if (!evento.membros) evento.membros = [];
            if (!evento.reserva) evento.reserva = [];

            if (evento.membros.some(m => String(m.id) === String(idParaAdicionar)) || evento.reserva.some(m => String(m.id) === String(idParaAdicionar))) {
                return res.send(gerarPainelComReserva(guildId));
            }

            // GUARDA A ORDEM REAL: Adiciona um marcador de tempo (timestamp) para sabermos quem entrou primeiro
            const novoMembro = { 
                id: String(idParaAdicionar), 
                username: username || "Membro", 
                inseridoEm: Date.now() 
            };

            if (evento.membros.length < evento.contingenteMax) {
                evento.membros.push(novoMembro);
                
                // ORDENAÇÃO FORÇADA: Garante que a lista siga a ordem de chegada cronológica
                evento.membros.sort((a, b) => (a.inseridoEm || 0) - (b.inseridoEm || 0));
                
                salvarDadosNoDisco();
                return res.send(gerarPainelComReserva(guildId));
            } 
            if (evento.reserva.length < 5) {
                evento.reserva.push(novoMembro);
                evento.reserva.sort((a, b) => (a.inseridoEm || 0) - (b.inseridoEm || 0));
                
                salvarDadosNoDisco();
                return res.send(gerarPainelComReserva(guildId));
            }
            return res.status(400).send("❌ A lista principal e a fila de reserva já estão lotadas!");
        }

        // --- AÇÃO: REMOVER MANUAL ---
        if (acao === 'sair' || acao === 'remover_manual') {
            const idParaRemover = (acao === 'remover_manual') ? idAlvo : userId;

            if (!idParaRemover || idParaRemover === guildId) {
                return res.status(400).send("❌ ID do usuário inválido ou ausente.");
            }

            const indexReserva = evento.reserva.findIndex(m => String(m.id) === String(idParaRemover));
            if (indexReserva !== -1) {
                evento.reserva.splice(indexReserva, 1);
                salvarDadosNoDisco();
                return res.send(gerarPainelComReserva(guildId));
            }

            const indexPrincipal = evento.membros.findIndex(m => String(m.id) === String(idParaRemover));
            if (indexPrincipal !== -1) {
                evento.membros.splice(indexPrincipal, 1);
                if (evento.reserva.length > 0) {
                    const primeiroDaReserva = evento.reserva.shift();
                    evento.membros.push(primeiroDaReserva);
                }
                // Reordena após a remoção para manter a integridade cronológica
                evento.membros.sort((a, b) => (a.inseridoEm || 0) - (b.inseridoEm || 0));
                salvarDadosNoDisco();
                return res.send(gerarPainelComReserva(guildId));
            }
            return res.send(gerarPainelComReserva(guildId));
        }

        if (acao === 'encerrar') {
            let statusResultado = '💀 DERROTA';
            let corEmbed = '#e74c3c';
            let iconeEmbed = 'https://discordapp.com';
            let rotuloValor = 'Valor Recebido'; 
            let bannerEmbed = 'https://imgur.com';

            if (resultado) {
                const resultadoFormatado = String(resultado).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (resultadoFormatado.includes('vitoria') || resultadoFormatado.includes('🏆')) {
                    statusResultado = '🏆 VITÓRIA';
                    corEmbed = '#2ecc71';
                    iconeEmbed = 'https://discordapp.com';
                    rotuloValor = 'Valor Ganho'; 
                    bannerEmbed = 'https://imgur.com';
                }
            }
            
            const valorFinalExibido = valorGanho ? "R$ " + valorGanho : "Não informado";
            const dataHoraFechamento = obterDataHoraBrasilia();

            let relatorioTexto = "🏁 **AÇÃO ENCERRADA • RELATÓRIO OFICIAL**\n\n";
            relatorioTexto += "> ⚔️ **Operação realizada:** `" + (evento.tipoAcao || "Não informado") + "`\n";
            relatorioTexto += "> 🟢 **Resultado:** `" + statusResultado + "`\n";
            relatorioTexto += "> 💰 " + rotuloValor + ": " + valorFinalExibido + "\n";
            relatorioTexto += "> 👤 Finalizado por: <@" + (userId || "ID ausente") + ">\n";
            relatorioTexto += "> 📅 Data & Horário: " + dataHoraFechamento + "\n\n";
            relatorioTexto += "🎖️ MEMBROS PARTICIPANTES:\n";

            if (evento.membros.length === 0) {
                relatorioTexto += "Nenhum membro assinou a lista.";
            } else {
                evento.membros.sort((a, b) => (a.inseridoEm || 0) - (b.inseridoEm || 0));
                evento.membros.forEach((membro, index) => {
                    relatorioTexto += "" + (index + 1) + " - <@" + membro.id + ">\n";
                });
            }
            
            const respostaEstruturada = {
                texto: relatorioTexto,
                cor: corEmbed,
                icone: iconeEmbed,
                banner: bannerEmbed
            };

            ultimosRelatorios[guildId] = respostaEstruturada;
            delete eventosComReserva[guildId];
            salvarDadosNoDisco();
            return res.json(respostaEstruturada);
        }
        
        return res.send(gerarPainelComReserva(guildId));
    } catch (e) {
        return res.status(500).send("❌ Erro interno.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Servidor rodando na porta " + PORT));
