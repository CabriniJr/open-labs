package br.com.openlabs.telecentro.connection;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

import org.springframework.stereotype.Component;

/**
 * Abre conexões JDBC com o Oracle da FIAP.
 * As credenciais vêm de variáveis de ambiente, para nunca irem para o GitHub.
 */
@Component
public class ConnectionFactory {

    private static final String URL_PADRAO = "jdbc:oracle:thin:@oracle.fiap.com.br:1521:ORCL";

    private final String url;
    private final String usuario;
    private final String senha;

    public ConnectionFactory() {
        this.url = System.getenv().getOrDefault("DB_URL", URL_PADRAO);
        this.usuario = System.getenv("DB_USER");
        this.senha = System.getenv("DB_PASSWORD");
    }

    public Connection getConnection() throws SQLException {
        return DriverManager.getConnection(url, usuario, senha);
    }
}
