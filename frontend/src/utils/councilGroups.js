export function groupCouncilMembers(leaders, committees) {
  const groups = committees.map(committee => ({
    ...committee,
    leaders: leaders.filter(leader => leader.committeeIds.includes(committee.id))
  }))
  const unassigned = leaders.filter(leader => !committees.some(committee => leader.committeeIds.includes(committee.id)))
  if (unassigned.length) groups.push({ id: 'unassigned', name: 'Sin comité', leaders: unassigned })
  return groups.filter(group => group.leaders.length)
}
