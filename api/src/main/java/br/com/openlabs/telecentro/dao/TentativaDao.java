package br.com.openlabs.telecentro.dao;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;

import br.com.openlabs.telecentro.connection.ConnectionFactory;
import br.com.openlabs.telecentro.exception.PersistenciaException;
import br.com.openlabs.telecentro.model.Tentativa;

/**
 * Acesso à tabela T_TENTATIVA com JDBC puro.
 * Tentativa é imutável, então este DAO não tem atualizar: só consulta, insere e exclui.
 */
@Repository
public class TentativaDao implements LeituraDao<Tentativa> {

    private final ConnectionFactory connectionFactory;

    public TentativaDao(ConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    @Override
    public Optional<Tentativa> buscarPorId(Long id) {
        String sql = """
                SELECT id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota
                FROM T_TENTATIVA WHERE id_tentativa = ?""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapear(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao buscar a tentativa " + id + ".", e);
        }
    }

    @Override
    public List<Tentativa> listar() {
        String sql = """
                SELECT id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota
                FROM T_TENTATIVA ORDER BY id_tentativa""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return mapearTodas(rs);
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar as tentativas.", e);
        }
    }

    public List<Tentativa> listarPorAluno(Long idAluno) {
        String sql = """
                SELECT id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota
                FROM T_TENTATIVA WHERE id_aluno = ? ORDER BY dt_envio, id_tentativa""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, idAluno);
            try (ResultSet rs = ps.executeQuery()) {
                return mapearTodas(rs);
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar as tentativas do aluno " + idAluno + ".", e);
        }
    }

    /** Tentativas de todos os alunos de um telecentro (usado pelo indicador de impacto). */
    public List<Tentativa> listarPorTelecentro(Long idTelecentro) {
        String sql = """
                SELECT t.id_tentativa, t.id_aluno, t.id_avaliacao, t.dt_envio, t.nr_acertos, t.vl_nota
                FROM T_TENTATIVA t JOIN T_ALUNO a ON a.id_aluno = t.id_aluno
                WHERE a.id_telecentro = ? ORDER BY t.dt_envio, t.id_tentativa""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, idTelecentro);
            try (ResultSet rs = ps.executeQuery()) {
                return mapearTodas(rs);
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar as tentativas do telecentro " + idTelecentro + ".", e);
        }
    }

    /** Grava a tentativa e devolve uma nova instância já com o id gerado pelo Oracle. */
    public Tentativa inserir(Tentativa tentativa) {
        String sql = """
                INSERT INTO T_TENTATIVA (id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota)
                VALUES (?, ?, ?, ?, ?)""";
        // O segundo argumento pede ao Oracle o ID_TENTATIVA gerado pela coluna IDENTITY.
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, new String[] {"ID_TENTATIVA"})) {
            ps.setLong(1, tentativa.getIdAluno());
            ps.setLong(2, tentativa.getIdAvaliacao());
            ps.setDate(3, Date.valueOf(tentativa.getDataEnvio()));
            ps.setInt(4, tentativa.getAcertos());
            ps.setBigDecimal(5, tentativa.getNota());
            ps.executeUpdate();
            try (ResultSet chaves = ps.getGeneratedKeys()) {
                chaves.next();
                return new Tentativa(chaves.getLong(1), tentativa.getIdAluno(), tentativa.getIdAvaliacao(),
                        tentativa.getDataEnvio(), tentativa.getAcertos(), tentativa.getNota());
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao inserir a tentativa.", e);
        }
    }

    public void excluir(Long id) {
        String sql = "DELETE FROM T_TENTATIVA WHERE id_tentativa = ?";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao excluir a tentativa " + id + ".", e);
        }
    }

    private List<Tentativa> mapearTodas(ResultSet rs) throws SQLException {
        List<Tentativa> tentativas = new ArrayList<>();
        while (rs.next()) {
            tentativas.add(mapear(rs));
        }
        return tentativas;
    }

    /** O Oracle devolve 8.00 como 8; setScale(2) mantém a nota sempre com 2 casas. */
    private Tentativa mapear(ResultSet rs) throws SQLException {
        return new Tentativa(
                rs.getLong("id_tentativa"),
                rs.getLong("id_aluno"),
                rs.getLong("id_avaliacao"),
                rs.getDate("dt_envio").toLocalDate(),
                rs.getInt("nr_acertos"),
                rs.getBigDecimal("vl_nota").setScale(2));
    }
}
