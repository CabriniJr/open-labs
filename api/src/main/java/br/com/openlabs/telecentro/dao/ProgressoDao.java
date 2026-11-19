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
import br.com.openlabs.telecentro.model.Progresso;

/** Acesso à tabela T_PROGRESSO com JDBC puro. */
@Repository
public class ProgressoDao implements CrudDao<Progresso> {

    private final ConnectionFactory connectionFactory;

    public ProgressoDao(ConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    @Override
    public Optional<Progresso> buscarPorId(Long id) {
        String sql = """
                SELECT id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao
                FROM T_PROGRESSO WHERE id_progresso = ?""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapear(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao buscar o progresso " + id + ".", e);
        }
    }

    @Override
    public List<Progresso> listar() {
        String sql = """
                SELECT id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao
                FROM T_PROGRESSO ORDER BY id_progresso""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return mapearTodos(rs);
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar os progressos.", e);
        }
    }

    public List<Progresso> listarPorAluno(Long idAluno) {
        String sql = """
                SELECT id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao
                FROM T_PROGRESSO WHERE id_aluno = ? ORDER BY dt_inicio, id_progresso""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, idAluno);
            try (ResultSet rs = ps.executeQuery()) {
                return mapearTodos(rs);
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar os progressos do aluno " + idAluno + ".", e);
        }
    }

    /** Progressos de todos os alunos de um telecentro (usado pelo indicador de impacto). */
    public List<Progresso> listarPorTelecentro(Long idTelecentro) {
        String sql = """
                SELECT p.id_progresso, p.id_aluno, p.id_lab, p.dt_inicio, p.dt_conclusao
                FROM T_PROGRESSO p JOIN T_ALUNO a ON a.id_aluno = p.id_aluno
                WHERE a.id_telecentro = ? ORDER BY p.id_progresso""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, idTelecentro);
            try (ResultSet rs = ps.executeQuery()) {
                return mapearTodos(rs);
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar os progressos do telecentro " + idTelecentro + ".", e);
        }
    }

    @Override
    public Progresso inserir(Progresso progresso) {
        String sql = """
                INSERT INTO T_PROGRESSO (id_aluno, id_lab, dt_inicio, dt_conclusao)
                VALUES (?, ?, ?, ?)""";
        // O segundo argumento pede ao Oracle o ID_PROGRESSO gerado pela coluna IDENTITY.
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, new String[] {"ID_PROGRESSO"})) {
            ps.setLong(1, progresso.getIdAluno());
            ps.setLong(2, progresso.getIdLab());
            ps.setDate(3, Date.valueOf(progresso.getDataInicio()));
            ps.setDate(4, progresso.getDataConclusao().map(Date::valueOf).orElse(null));
            ps.executeUpdate();
            try (ResultSet chaves = ps.getGeneratedKeys()) {
                chaves.next();
                return new Progresso(chaves.getLong(1), progresso.getIdAluno(), progresso.getIdLab(),
                        progresso.getDataInicio(), progresso.getDataConclusao().orElse(null));
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao inserir o progresso.", e);
        }
    }

    /** Só a data de conclusão muda num progresso; aluno, lab e início são fixos. */
    @Override
    public void atualizar(Progresso progresso) {
        String sql = "UPDATE T_PROGRESSO SET dt_conclusao = ? WHERE id_progresso = ?";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setDate(1, progresso.getDataConclusao().map(Date::valueOf).orElse(null));
            ps.setLong(2, progresso.getId());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao atualizar o progresso " + progresso.getId() + ".", e);
        }
    }

    @Override
    public void excluir(Long id) {
        String sql = "DELETE FROM T_PROGRESSO WHERE id_progresso = ?";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao excluir o progresso " + id + ".", e);
        }
    }

    private List<Progresso> mapearTodos(ResultSet rs) throws SQLException {
        List<Progresso> progressos = new ArrayList<>();
        while (rs.next()) {
            progressos.add(mapear(rs));
        }
        return progressos;
    }

    /** dt_conclusao pode ser NULL (lab em andamento). */
    private Progresso mapear(ResultSet rs) throws SQLException {
        Date conclusao = rs.getDate("dt_conclusao");
        return new Progresso(
                rs.getLong("id_progresso"),
                rs.getLong("id_aluno"),
                rs.getLong("id_lab"),
                rs.getDate("dt_inicio").toLocalDate(),
                conclusao == null ? null : conclusao.toLocalDate());
    }
}
