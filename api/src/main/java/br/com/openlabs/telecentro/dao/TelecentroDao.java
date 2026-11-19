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
import br.com.openlabs.telecentro.model.Telecentro;

/** Acesso à tabela T_TELECENTRO com JDBC puro. */
@Repository
public class TelecentroDao implements CrudDao<Telecentro> {

    private final ConnectionFactory connectionFactory;

    public TelecentroDao(ConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    @Override
    public Optional<Telecentro> buscarPorId(Long id) {
        String sql = """
                SELECT id_telecentro, nm_telecentro, nm_bairro, nm_cidade, sg_uf, nr_computadores,
                ds_faixa_rede, dt_inauguracao FROM T_TELECENTRO WHERE id_telecentro = ?""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapear(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao buscar o telecentro " + id + ".", e);
        }
    }

    @Override
    public List<Telecentro> listar() {
        String sql = """
                SELECT id_telecentro, nm_telecentro, nm_bairro, nm_cidade, sg_uf, nr_computadores,
                ds_faixa_rede, dt_inauguracao FROM T_TELECENTRO ORDER BY id_telecentro""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            List<Telecentro> telecentros = new ArrayList<>();
            while (rs.next()) {
                telecentros.add(mapear(rs));
            }
            return telecentros;
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar os telecentros.", e);
        }
    }

    @Override
    public Telecentro inserir(Telecentro telecentro) {
        String sql = """
                INSERT INTO T_TELECENTRO (nm_telecentro, nm_bairro, nm_cidade, sg_uf, nr_computadores,
                ds_faixa_rede, dt_inauguracao) VALUES (?, ?, ?, ?, ?, ?, ?)""";
        // O segundo argumento pede ao Oracle o ID_TELECENTRO gerado pela coluna IDENTITY.
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, new String[] {"ID_TELECENTRO"})) {
            preencherParametros(ps, telecentro);
            ps.executeUpdate();
            try (ResultSet chaves = ps.getGeneratedKeys()) {
                chaves.next();
                return new Telecentro(chaves.getLong(1), telecentro.getNome(), telecentro.getBairro(),
                        telecentro.getCidade(), telecentro.getUf(), telecentro.getNumeroComputadores(),
                        telecentro.getFaixaRede(), telecentro.getDataInauguracao());
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao inserir o telecentro.", e);
        }
    }

    @Override
    public void atualizar(Telecentro telecentro) {
        String sql = """
                UPDATE T_TELECENTRO SET nm_telecentro = ?, nm_bairro = ?, nm_cidade = ?, sg_uf = ?,
                nr_computadores = ?, ds_faixa_rede = ?, dt_inauguracao = ? WHERE id_telecentro = ?""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            preencherParametros(ps, telecentro);
            ps.setLong(8, telecentro.getId());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao atualizar o telecentro " + telecentro.getId() + ".", e);
        }
    }

    @Override
    public void excluir(Long id) {
        String sql = "DELETE FROM T_TELECENTRO WHERE id_telecentro = ?";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao excluir o telecentro " + id + ".", e);
        }
    }

    /** Os 7 primeiros parâmetros, na mesma ordem no INSERT e no UPDATE. */
    private void preencherParametros(PreparedStatement ps, Telecentro telecentro) throws SQLException {
        ps.setString(1, telecentro.getNome());
        ps.setString(2, telecentro.getBairro());
        ps.setString(3, telecentro.getCidade());
        ps.setString(4, telecentro.getUf());
        ps.setInt(5, telecentro.getNumeroComputadores());
        ps.setString(6, telecentro.getFaixaRede());
        ps.setDate(7, Date.valueOf(telecentro.getDataInauguracao()));
    }

    private Telecentro mapear(ResultSet rs) throws SQLException {
        return new Telecentro(
                rs.getLong("id_telecentro"),
                rs.getString("nm_telecentro"),
                rs.getString("nm_bairro"),
                rs.getString("nm_cidade"),
                rs.getString("sg_uf"),
                rs.getInt("nr_computadores"),
                rs.getString("ds_faixa_rede"),
                rs.getDate("dt_inauguracao").toLocalDate());
    }
}
