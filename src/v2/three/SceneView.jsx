import { TableauView } from './Stage'
import Tableau from './Tableau'

// Lazy entry point so three.js loads after the text has painted.
export default function SceneView({ className, ...tableau }) {
  return (
    <TableauView className={className}>
      <Tableau {...tableau} />
    </TableauView>
  )
}
