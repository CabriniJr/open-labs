package br.com.openlabs.telecentro.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;

import br.com.openlabs.telecentro.connection.ConnectionFactory;
import br.com.openlabs.telecentro.exception.PersistenciaException;
import br.com.openlabs.telecentro.model.Avaliacao;

/** Leitura da tabela T_AVALIACAO com JDBC puro. As avaliações são só leitura. */
@Repository
public class AvaliacaoDao implements LeituraDao<Avaliacao> {

    private final ConnectionFactory connectionFactory;

    public AvaliacaoDao(ConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    @Override
    public Optional<Avaliacao> buscarPorId(Long id) {
        String sql = """
                SELECT id_avaliacao, id_lab, nm_avaliacao, nr_questoes, pc_aprovacao
                FROM T_AVALIACAO WHERE id_avaliacao = ?""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapear(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao buscar a avaliação " + id + ".", e);
        }
    }

    @Override
    public List<Avaliacao> listar() {
        String sql = """
                SELECT id_avaliacao, id_lab, nm_avaliacao, nr_questoes, pc_aprovacao
                FROM T_AVALIACAO ORDER BY id_avaliacao""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return mapearTodas(rs);
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar as avaliações.", e);
        }
    }

    public List<Avaliacao> listarPorLab(Long idLab) {
        String sql = """
                SELECT id_avaliacao, id_lab, nm_avaliacao, nr_questoes, pc_aprovacao
                FROM T_AVALIACAO WHERE id_lab = ? ORDER BY id_avaliacao""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, idLab);
            try (ResultSet rs = ps.executeQuery()) {
                return mapearTodas(rs);
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar as avaliações do lab " + idLab + ".", e);
        }
    }

    private List<Avaliacao> mapearTodas(ResultSet rs) throws SQLException {
        List<Avaliacao> avaliacoes = new ArrayList<>();
        while (rs.next()) {
            avaliacoes.add(mapear(rs));
        }
        return avaliacoes;
    }

    private Avaliacao mapear(ResultSet rs) throws SQLException {
        return new Avaliacao(
                rs.getLong("id_avaliacao"),
                rs.getLong("id_lab"),
                rs.getString("nm_avaliacao"),
                rs.getInt("nr_questoes"),
                rs.getInt("pc_aprovacao"));
    }
}
