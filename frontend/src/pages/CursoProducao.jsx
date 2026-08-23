import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useData } from '../context/DataContext'
import ModulosWorkspace from '../components/producao/ModulosWorkspace'

/**
 * Producao de um curso, em endereco proprio.
 *
 * Antes esta tela era um ramo de /producao: o botao "Producao" do card navegava
 * para la levando o NOME do curso no estado da rota, e a pagina decidia entre a
 * visao por modulos e a tabela consolidada conforme esse estado existisse ou
 * nao. Dois problemas vinham dai.
 *
 * O primeiro era recarregar: o estado da navegacao nao sobrevive ao F5, entao
 * apertar F5 na producao de um curso jogava a pessoa na visao geral -- ou no
 * aviso de acesso restrito, se ela nao tivesse essa visao. Com o curso no
 * endereco, recarregar e compartilhar o link passam a funcionar.
 *
 * O segundo era de permissao: perfis que so alcancam Cursos -- gerencia --
 * batiam na restricao de rota de /producao e voltavam para Cursos sem
 * explicacao. Como subrota de /cursos, a producao acompanha quem alcanca o
 * curso.
 */
export default function CursoProducao() {
  const { courseId } = useParams()
  const { courses, coursesLoading } = useData()
  const navigate = useNavigate()

  const course = courses.find((c) => Number(c.id) === Number(courseId))

  // Enquanto os cursos carregam, `find` devolve undefined -- sem esta espera a
  // tela anunciaria "curso nao encontrado" a cada abertura, antes dos dados
  // chegarem.
  if (!course && coursesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-700 border-t-transparent" />
      </div>
    )
  }

  /**
   * Curso ausente da lista cobre dois casos com a mesma resposta: id que nao
   * existe, e curso que existe mas nao e visivel para este perfil (a API filtra
   * por perfil em listCourses). Nao distinguir os dois e proposital -- responder
   * "existe, mas nao e seu" confirmaria a existencia do curso a quem nao deveria
   * saber.
   */
  if (!course) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle size={22} />
        </div>
        <div>
          <p className="font-semibold text-gray-800">Curso não encontrado</p>
          <p className="mt-1 max-w-md text-sm text-gray-500">
            Ele pode ter sido removido, ou não estar entre os cursos aos quais você tem acesso.
          </p>
        </div>
        <button onClick={() => navigate('/cursos')} className="btn-primary mt-2">
          Voltar para Cursos
        </button>
      </div>
    )
  }

  return <ModulosWorkspace course={course} />
}
