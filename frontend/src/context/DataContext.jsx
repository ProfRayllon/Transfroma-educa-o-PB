import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { mockMaterials, mockCourses } from '../data/mockData'
import { useAuth } from './AuthContext'
import api, { getApiErrorMessage } from '../lib/api'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [materials, setMaterials] = useState(mockMaterials)
  const [courses, setCourses] = useState(mockCourses)
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [coursesError, setCoursesError] = useState(null)
  const [courseParticipants, setCourseParticipants] = useState({ supervisors: [], coordinators: [], producers: [] })
  const [materialAssignees, setMaterialAssignees] = useState([])

  const loadCourses = useCallback(async () => {
    if (!user) {
      setMaterials(mockMaterials)
      setCourses(mockCourses)
      setCourseParticipants({ supervisors: [], coordinators: [], producers: [] })
      setMaterialAssignees([])
      setCoursesError(null)
      return
    }

    setCoursesLoading(true)
    setCoursesError(null)

    try {
      const { data: materialsData } = await api.get('/materials')
      setMaterials(materialsData)
      const { data } = await api.get('/courses')
      setCourses(data)
      const { data: participants } = await api.get('/course-participants')
      setCourseParticipants(participants)
      const { data: assignees } = await api.get('/material-assignees')
      setMaterialAssignees(assignees)
    } catch (error) {
      setCoursesError(getApiErrorMessage(error, 'Erro ao carregar cursos.'))
    } finally {
      setCoursesLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadCourses()
  }, [loadCourses])

  const saveCourse = async (course) => {
    try {
      const request = course.id
        ? api.put(`/courses/${course.id}`, course)
        : api.post('/courses', course)
      const { data } = await request

      setCourses((current) => {
        if (course.id) {
          return current.map((item) => (item.id === data.id ? data : item))
        }

        return [...current, data].sort((a, b) => String(a.name).localeCompare(String(b.name)))
      })

      return data
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Erro ao salvar curso.'))
    }
  }

  const deleteCourse = async (courseId) => {
    try {
      await api.delete(`/courses/${courseId}`)
      setCourses((current) => current.filter((course) => course.id !== courseId))
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Erro ao excluir curso.'))
    }
  }

  const saveMaterial = async (material) => {
    try {
      const request = material.id
        ? api.put(`/materials/${material.id}`, material)
        : api.post('/materials', material)
      const { data } = await request

      setMaterials((current) => {
        if (material.id) {
          return current.map((item) => (item.id === data.id ? data : item))
        }

        return [...current, data]
      })

      return data
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Erro ao salvar atividade.'))
    }
  }

  const approveMaterial = async (materialId) => {
    try {
      const { data } = await api.patch(`/materials/${materialId}/approve`)
      setMaterials((current) => current.map((item) => (item.id === data.id ? data : item)))
      return data
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Erro ao aprovar atividade.'))
    }
  }

  const updateMaterialStatus = async (materialId, statusUpdate) => {
    try {
      const { data } = await api.patch(`/materials/${materialId}/status`, statusUpdate)
      setMaterials((current) => current.map((item) => (item.id === data.id ? data : item)))
      return data
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Erro ao atualizar status.'))
    }
  }

  const updateMaterialSession = async (materialId, session) => {
    try {
      const { data } = await api.patch(`/materials/${materialId}/session`, { session })
      setMaterials((current) => current.map((item) => (item.id === data.id ? data : item)))
      return data
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Erro ao mover sessao.'))
    }
  }

  return (
    <DataContext.Provider value={{
      materials,
      setMaterials,
      courses,
      setCourses,
      coursesLoading,
      coursesError,
      courseParticipants,
      materialAssignees,
      loadCourses,
      saveCourse,
      deleteCourse,
      saveMaterial,
      approveMaterial,
      updateMaterialStatus,
      updateMaterialSession,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
