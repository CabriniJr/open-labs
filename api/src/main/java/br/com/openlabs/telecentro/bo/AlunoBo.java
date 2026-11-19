package br.com.openlabs.telecentro.bo;

import java.util.List;

import org.springframework.stereotype.Service;

import br.com.openlabs.telecentro.dao.AlunoDao;
import br.com.openlabs.telecentro.dto.AlunoRequest;
import br.com.openlabs.telecentro.exception.RecursoNaoEncontradoException;
import br.com.openlabs.telecentro.model.Aluno;

/**
 * Casos de uso do aluno: busca no DAO, chama o método de domínio e persiste.
 * As regras do próprio aluno (nome, nascimento, ativo) ficam na entidade Aluno.
 */
@Service
public class AlunoBo {

    private final AlunoDao alunoDao;

    public AlunoBo(AlunoDao alunoDao) {
        this.alunoDao = alunoDao;
    }

    /** Lista todos os alunos ou só os do telecentro informado. */
    public List<Aluno> listar(Long idTelecentro) {
        return idTelecentro == null ? alunoDao.listar() : alunoDao.listarPorTelecentro(idTelecentro);
    }

    public Aluno buscar(Long id) {
        return alunoDao.buscarPorId(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Aluno " + id + " não encontrado."));
    }

    /** Se o telecentro não existir, o Oracle recusa o INSERT (FK, ORA-02291) e o tratador devolve 404. */
    public Aluno cadastrar(AlunoRequest dados) {
        Aluno novo = Aluno.cadastrar(dados.idTelecentro(), dados.nome(), dados.dataNascimento(), dados.email());
        return alunoDao.inserir(novo);
    }

    public Aluno atualizar(Long id, AlunoRequest dados) {
        Aluno aluno = buscar(id);
        aluno.atualizarCadastro(dados.idTelecentro(), dados.nome(), dados.dataNascimento(), dados.email());
        alunoDao.atualizar(aluno);
        return aluno;
    }

    public Aluno desativar(Long id) {
        Aluno aluno = buscar(id);
        aluno.desativar();
        alunoDao.atualizar(aluno);
        return aluno;
    }

    /** Se o aluno tiver progresso ou tentativas, o Oracle recusa o DELETE (ORA-02292) e o tratador devolve 409. */
    public void excluir(Long id) {
        buscar(id);
        alunoDao.excluir(id);
    }
}
