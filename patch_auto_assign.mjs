import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf-8');

const replacement = `      const existingLead = await db.select({
          assignedUserId: schema.leads.assignedUserId,
          clientName: schema.leads.clientName,
          status: schema.leads.status,
          techAssignmentStatus: schema.leads.techAssignmentStatus,
          declinedTechIds: schema.leads.declinedTechIds,
          address: schema.leads.address
        }).from(schema.leads).where(eq(schema.leads.id, Number(id))).then(res => res[0] || null);

      if (!existingLead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      if (req.user.role !== 'Admin' && existingLead.assignedUserId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to modify this lead. It is assigned to someone else.' });
      }

      // Check if status changed to a scheduling stage
      const schedulingStages = ["Scheduled", "Installed", "Site Visit Scheduled", "Installation Scheduled"];
      let newPendingTechId = undefined;
      let newTechAssignmentStatus = undefined;
      
      if (status && status !== existingLead.status && schedulingStages.includes(status) && (!existingLead.techAssignmentStatus || existingLead.techAssignmentStatus === 'Declined')) {
        // Auto-assign algorithm
        const techs = await db.select().from(schema.users).where(eq(schema.users.role, 'Technician'));
        
        if (techs.length > 0) {
          // Get workload for each tech
          let bestTech = null;
          let minWorkload = Infinity;
          
          const declinedArr = existingLead.declinedTechIds ? JSON.parse(existingLead.declinedTechIds) : [];
          
          for (const tech of techs) {
            if (declinedArr.includes(tech.id)) continue; // skip declined
            
            const workloadResult = await db.select({ count: sql\`count(*)\`.mapWith(Number) })
              .from(schema.leads)
              .where(eq(schema.leads.assignedUserId, tech.id));
              
            const count = workloadResult[0].count;
            
            // Proximity heuristic based on address match (simple text include)
            let score = count;
            const techName = tech.username.toLowerCase();
            const addr = (address || existingLead.address || '').toLowerCase();
            if (addr && addr.includes(techName)) {
               score -= 10; // artificially prioritize if address matches tech somehow (mock proximity)
            }
            
            if (score < minWorkload) {
              minWorkload = score;
              bestTech = tech;
            }
          }
          
          if (bestTech) {
            newPendingTechId = bestTech.id;
            newTechAssignmentStatus = 'Pending';
            
            // Send notification
            await db.insert(schema.notifications).values({
              userId: bestTech.id,
              title: 'New Lead Assignment',
              message: \`You have been selected for a new task: \${clientName}\`
            });
            // if io is available we could emit, but we'll let polling/standard ws handle it
          }
        }
      }

      const updateData = {
        clientName, contact, address, assignedUserId, requiredProduct,
        quantity, price, notes: JSON.stringify(notes || []), nextFollowUp, visitSchedule,
        installationSchedule, actualInstallDate, status, priority,
        email, tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags || [])
      };
      
      if (newPendingTechId !== undefined) {
        updateData.pendingTechId = newPendingTechId;
        updateData.techAssignmentStatus = newTechAssignmentStatus;
      }

      await db.update(schema.leads).set(updateData).where(eq(schema.leads.id, Number(id)));`;

code = code.replace(/      const existingLead = await db\.select\(\{[\s\S]*?\}\)[\s\S]*?\.where\(eq\(schema\.leads\.id, Number\(id\)\)\);/m, replacement);

fs.writeFileSync('server.ts', code);
