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
import br.com.openlabs.telecentro.model.Aluno;

/** Acesso à tabela T_ALUNO com JDBC puro. */
@Repository
public class AlunoDao implements CrudDao<Aluno> {

    private final ConnectionFactory connectionFactory;

    public AlunoDao(ConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    @Override
    public Optional<Aluno> buscarPorId(Long id) {
        String sql = """
                SELECT id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo
                FROM T_ALUNO WHERE id_aluno = ?""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapear(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao buscar o aluno " + id + ".", e);
        }
    }

    @Override
    public List<Aluno> listar() {
        String sql = """
                SELECT id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo
                FROM T_ALUNO ORDER BY id_aluno""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return mapearTodos(rs);
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar os alunos.", e);
        }
    }

    public List<Aluno> listarPorTelecentro(Long idTelecentro) {
        String sql = """
                SELECT id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo
                FROM T_ALUNO WHERE id_telecentro = ? ORDER BY id_aluno""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, idTelecentro);
            try (ResultSet rs = ps.executeQuery()) {
                return mapearTodos(rs);
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar os alunos do telecentro " + idTelecentro + ".", e);
        }
    }

    @Override
    public Aluno inserir(Aluno aluno) {
        String sql = """
                INSERT INTO T_ALUNO (id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo)
                VALUES (?, ?, ?, ?, ?, ?)""";
        // O segundo argumento pede ao Oracle o ID_ALUNO gerado pela coluna IDENTITY.
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, new String[] {"ID_ALUNO"})) {
            preencherParametros(ps, aluno);
            ps.executeUpdate();
            try (ResultSet chaves = ps.getGeneratedKeys()) {
                chaves.next();
                return new Aluno(chaves.getLong(1), aluno.getIdTelecentro(), aluno.getNome(),
                        aluno.getDataNascimento(), aluno.getEmail().orElse(null),
                        aluno.getDataCadastro(), aluno.isAtivo());
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao inserir o aluno.", e);
        }
    }

    @Override
    public void atualizar(Aluno aluno) {
        String sql = """
                UPDATE T_ALUNO SET id_telecentro = ?, nm_aluno = ?, dt_nascimento = ?, ds_email = ?,
                dt_cadastro = ?, st_ativo = ? WHERE id_aluno = ?""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            preencherParametros(ps, aluno);
            ps.setLong(7, aluno.getId());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao atualizar o aluno " + aluno.getId() + ".", e);
        }
    }

    @Override
    public void excluir(Long id) {
        String sql = "DELETE FROM T_ALUNO WHERE id_aluno = ?";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao excluir o aluno " + id + ".", e);
        }
    }

    /** Os 6 primeiros parâmetros, na mesma ordem no INSERT e no UPDATE. */
    private void preencherParametros(PreparedStatement ps, Aluno aluno) throws SQLException {
        ps.setLong(1, aluno.getIdTelecentro());
        ps.setString(2, aluno.getNome());
        ps.setDate(3, Date.valueOf(aluno.getDataNascimento()));
        ps.setString(4, aluno.getEmail().orElse(null));
        ps.setDate(5, Date.valueOf(aluno.getDataCadastro()));
        ps.setString(6, aluno.isAtivo() ? "S" : "N");
    }

    private List<Aluno> mapearTodos(ResultSet rs) throws SQLException {
        List<Aluno> alunos = new ArrayList<>();
        while (rs.next()) {
            alunos.add(mapear(rs));
        }
        return alunos;
    }

    /** Converte a linha atual do ResultSet num Aluno. 'S'/'N' vira boolean aqui. */
    private Aluno mapear(ResultSet rs) throws SQLException {
        return new Aluno(
                rs.getLong("id_aluno"),
                rs.getLong("id_telecentro"),
                rs.getString("nm_aluno"),
                rs.getDate("dt_nascimento").toLocalDate(),
                rs.getString("ds_email"),
                rs.getDate("dt_cadastro").toLocalDate(),
                "S".equals(rs.getString("st_ativo")));
    }
}
