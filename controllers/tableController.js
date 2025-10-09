const Table = require('../models/Table');
const db = require('../config/database');

// Get all tables
const getAllTables = async (req, res) => {
  try {
   // const { type, status } = req.query;
    const tables = await Table.getAll();

    res.json({
      success: true,
      data: { tables }
    });
  } catch (error) {
    console.error('Get all tables error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tables',
      error: error.message
    });
  }
};

// Get available tables
const getAvailableTables = async (req, res) => {
  try {
    const { type, date, time } = req.query;
    const tables = await Table.getAvailable(type, date, time);

    res.json({
      success: true,
      data: { tables }
    });
  } catch (error) {
    console.error('Get available tables error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available tables',
      error: error.message
    });
  }
};

// Get table by ID
const getTableById = async (req, res) => {
  try {
    const { id } = req.params;
    const table = await Table.findById(id);

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // Get current session if any
    const currentSession = await Table.getCurrentSession(id);

    res.json({
      success: true,
      data: { 
        table,
        currentSession
      }
    });
  } catch (error) {
    console.error('Get table by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching table',
      error: error.message
    });
  }
};

// Create new table
const createTable = async (req, res) => {
  try {
    const tableData = req.body;
    const count = parseInt(tableData.count) || 1; // agar count na aaye toh default 1

    const createdTables = [];

    for (let i = 0; i < count; i++) {
      const tableId = await Table.create(tableData);
      const table = await Table.findById(tableId);
      createdTables.push(table);
    }

    res.status(201).json({
      success: true,
      message: `${count} table(s) created successfully`,
      data: createdTables
    });
  } catch (error) {
    console.error('Create table error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating tables',
      error: error.message
    });
  }
};


// Update table
const updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const tableData = req.body;

    // Check if table exists
    const existingTable = await Table.findById(id);
    if (!existingTable) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // Check if table number is already taken by another table
    if (tableData.table_number !== existingTable.table_number) {
      const numberExists = await Table.numberExists(tableData.table_number, id);
      if (numberExists) {
        return res.status(400).json({
          success: false,
          message: 'Table number already exists'
        });
      }
    }

    // Update table
    const updated = await Table.update(id, tableData);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update table'
      });
    }

    // Get updated table
    const table = await Table.findById(id);

    res.json({
      success: true,
      message: 'Table updated successfully',
      data: { table }
    });
  } catch (error) {
    console.error('Update table error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating table',
      error: error.message
    });
  }
};


// Update table status
const updateTableStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['available', 'occupied', 'reserved', 'maintenance'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Check if table exists
    const existingTable = await Table.findById(id);
    if (!existingTable) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // Update status
    const updated = await Table.updateStatus(id, status);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update table status'
      });
    }

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.emit('table_status_updated', { tableId: id, status });

    res.json({
      success: true,
      message: 'Table status updated successfully',
      data: { tableId: id, status }
    });
  } catch (error) {
    console.error('Update table status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating table status',
      error: error.message
    });
  }
};

// Delete table
const deleteTable = async (req, res) => {
  try {
    let { id } = req.params;   // single id route param se
    let { ids } = req.body;    // multiple ids body se

    let idList = [];

    if (ids && Array.isArray(ids)) {
      idList = ids;
    } else if (id) {
      idList = [id];
    } else {
      return res.status(400).json({
        success: false,
        message: 'No table id(s) provided'
      });
    }

    // ✅ Check each table before delete
    for (const tableId of idList) {
      const existingTable = await Table.findById(tableId);
      if (!existingTable) {
        return res.status(404).json({
          success: false,
          message: `Table with id ${tableId} not found`
        });
      }

      const currentSession = await Table.getCurrentSession(tableId);
      if (currentSession) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete table ${tableId} with active session`
        });
      }
    }

    // ✅ Delete
    const deleted = await Table.delete(idList);

    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Failed to delete table(s)'
      });
    }

    res.json({
      success: true,
      message: `${idList.length} table(s) deleted successfully`
    });
  } catch (error) {
    console.error('Delete table error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting table(s)',
      error: error.message
    });
  }
};


 // Get table statistics
  const getTableStats = async (req, res) => {
    try {
      const stats = await Table.getStats();

      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      console.error('Get table stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching table statistics',
        error: error.message
      });
    }
  };

// Get table groups
// const getTableGroups = async (req, res) => {
//   try {
//     const [groups] = await db.execute('SELECT * FROM table_groups ORDER BY name');

//     res.json({
//       success: true,
//       data: { groups }
//     });
//   } catch (error) {
//     console.error('Get table groups error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching table groups',
//       error: error.message
//     });
//   }
// };


const getTableGroups = async (req, res) => {
  try {
    // 1️⃣ Get all table groups
    const [groups] = await db.execute('SELECT * FROM table_groups ORDER BY name');

    for (let group of groups) {
      let tables = [];

      if (group.selected_pool) {
        // 2️⃣ If selected_pool exists, fetch tables by IDs
        // Convert string "107,108,109" to array of numbers
        const tableIds = group.selected_pool.split(',').map(id => parseInt(id.trim()));

        if (tableIds.length > 0) {
          const [result] = await db.execute(
            `SELECT id, table_name, table_type, table_number, status
             FROM tables
             WHERE id IN (${tableIds.join(',')})`
          );
          tables = result;
        }
      } else if (group.id) {
        // 3️⃣ Fallback: fetch tables by group_id
        const [result] = await db.execute(
          `SELECT id, table_name, table_type, table_number, status
           FROM tables
           WHERE group_id = ?`,
          [group.id]
        );
        tables = result;
      }

      group.tables = tables; // attach tables array
    }

    res.json({
      success: true,
      data: { groups }
    });
  } catch (error) {
    console.error('Get table groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching table groups',
      error: error.message
    });
  }
};




// Create table group
const createTableGroup = async (req, res) => {
  try {
    const {name,hourly_rate,fixed_rate,discout,selected_pool ,description, minimum_session_time } = req.body;

    const [result] = await db.execute(
      'INSERT INTO table_groups (name,hourly_rate,fixed_rate,discout,selected_pool ,description, minimum_session_time) VALUES (?, ?,?,?,?,?, ?)',
      [name,hourly_rate,fixed_rate,discout,selected_pool ,description, minimum_session_time]
    );


    const [group] = await db.execute(
      'SELECT * FROM table_groups WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Table group created successfully',
      data: { group: group[0] }
    });
  } catch (error) {
    console.error('Create table group error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating table group',
      error: error.message
    });
  }
};


// Update table group
const updateTableGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, hourly_rate, fixed_rate, discout, selected_pool, description, minimum_session_time } = req.body;

    // Check if table group exists
    const [existing] = await db.execute('SELECT * FROM table_groups WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Table group not found'
      });
    }

    // Update
    await db.execute(
      `UPDATE table_groups 
       SET name = ?, hourly_rate = ?, fixed_rate = ?, discout = ?, selected_pool = ?, description = ?, minimum_session_time = ?, updated_at = NOW() 
       WHERE id = ?`,
      [name, hourly_rate, fixed_rate, discout, selected_pool, description, minimum_session_time, id]
    );

    const [updatedGroup] = await db.execute('SELECT * FROM table_groups WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Table group updated successfully',
      data: { group: updatedGroup[0] }
    });
  } catch (error) {
    console.error('Update table group error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating table group',
      error: error.message
    });
  }
};


// Delete table group
const deleteTableGroup = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if exists
    const [existing] = await db.execute('SELECT * FROM table_groups WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Table group not found'
      });
    }

    // Delete
    await db.execute('DELETE FROM table_groups WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Table group deleted successfully'
    });
  } catch (error) {
    console.error('Delete table group error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting table group',
      error: error.message
    });
  }
};


// router.put('/table-groups/:id', updateTableGroup);
// router.delete('/table-groups/:id', deleteTableGroup);

module.exports = {
  getAllTables,
  getAvailableTables,
  getTableById,
  createTable,
  updateTable,
  updateTableStatus,
  deleteTable,
  getTableStats,
  getTableGroups,
  createTableGroup,
  updateTableGroup,
  deleteTableGroup


};
