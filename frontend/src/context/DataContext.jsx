import { createContext, useContext, useState } from 'react'
import { mockMaterials, mockCourses } from '../data/mockData'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [materials, setMaterials] = useState(mockMaterials)
  const [courses, setCourses] = useState(mockCourses)

  return (
    <DataContext.Provider value={{ materials, setMaterials, courses, setCourses }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
