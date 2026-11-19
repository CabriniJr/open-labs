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
import br.com.openlabs.telecentro.model.Lab;
import br.com.openlabs.telecentro.model.TipoInteracao;

/** Leitura da tabela T_LAB com JDBC puro. O catálogo de labs é só leitura. */
@Repository
public class LabDao implements LeituraDao<Lab> {

    private final ConnectionFactory connectionFactory;

    public LabDao(ConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    @Override
    public Optional<Lab> buscarPorId(Long id) {
        String sql = """
                SELECT id_lab, id_fase, cd_slug, nm_lab, tp_interacao, nr_minutos, st_disponivel
                FROM T_LAB WHERE id_lab = ?""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapear(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao buscar o lab " + id + ".", e);
        }
    }

    @Override
    public List<Lab> listar() {
        String sql = """
                SELECT id_lab, id_fase, cd_slug, nm_lab, tp_interacao, nr_minutos, st_disponivel
                FROM T_LAB ORDER BY id_lab""";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            List<Lab> labs = new ArrayList<>();
            while (rs.next()) {
                labs.add(mapear(rs));
            }
            return labs;
        } catch (SQLException e) {
            throw new PersistenciaException("Erro ao listar os labs.", e);
        }
    }

    /** 'fluxo' vira TipoInteracao.FLUXO e 'S'/'N' vira boolean aqui. */
    private Lab mapear(ResultSet rs) throws SQLException {
        return new Lab(
                rs.getLong("id_lab"),
                rs.getLong("id_fase"),
                rs.getString("cd_slug"),
                rs.getString("nm_lab"),
                TipoInteracao.doBanco(rs.getString("tp_interacao")),
                rs.getInt("nr_minutos"),
                "S".equals(rs.getString("st_disponivel")));
    }
}
